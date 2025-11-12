import { createClient } from '@vercel/kv';

const MAX_DISPLAY = 10;
const FETCH_MULTIPLIER = 4;
const FETCH_LIMIT = MAX_DISPLAY * FETCH_MULTIPLIER; // fetch extra entries to dedupe by player

function normalizePlayerName(name) {
  return String(name || '').trim().toLowerCase();
}

function filterUniquePlayers(entries, cap = MAX_DISPLAY) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    const key = normalizePlayerName(entry.playerName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
    if (unique.length >= cap) break;
  }
  return unique;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Robust debug detection: support both request.query and URLSearchParams
  let debug = false;
  try {
    if (request.query && (request.query.debug === '1' || request.query.debug === 'true')) debug = true;
    else if (request.url) {
      const u = new URL(request.url, `http://${request.headers?.host || 'localhost'}`);
      const q = u.searchParams.get('debug');
      if (q === '1' || q === 'true') debug = true;
    }
  } catch (_) {}

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    const scope = (process.env.LEADERBOARD_SCOPE || '').trim();
    const scopeSuffix = scope ? `:${scope}` : '';
    const baseKey = `scores_debug${scopeSuffix}`;
    const entryPrefix = `${baseKey}:entry`;

    if (!url || !token) {
      const payload = { timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' };
      payload._diag = { reason: 'missing_vercel_kv_credentials', hasUrl: !!url, hasToken: !!token, scope: scope || null };
      return response.status(200).json(payload);
    }

    const kv = createClient({ url, token });

    const keyTA = `${baseKey}:time_attack`;
    const keySR = `${baseKey}:speed_run`;
    const keyAll = `${baseKey}:all`;

    const endIndex = Math.max(0, FETCH_LIMIT - 1);
    const [taIds, srIds] = await Promise.all([
      kv.zrange(keyTA, 0, endIndex).catch(() => []),
      kv.zrange(keySR, 0, endIndex).catch(() => []),
    ]);

    async function hydrateEntries(ids, setKey, fallbackMode) {
      if (!Array.isArray(ids) || ids.length === 0) return [];

      const seen = new Set();
      const uniqueIds = [];
      const duplicates = [];
      ids.forEach((id) => {
        if (seen.has(id)) duplicates.push(id);
        else {
          seen.add(id);
          uniqueIds.push(id);
        }
      });

      if (duplicates.length) {
        try { await kv.zrem(setKey, ...duplicates); } catch (_) {}
        try { await kv.zrem(keyAll, ...duplicates); } catch (_) {}
      }

      if (!uniqueIds.length) return [];

      const entryKeys = uniqueIds.map((id) => `${entryPrefix}:${id}`);
      let rawEntries = [];
      try {
        rawEntries = await kv.mget(...entryKeys);
      } catch (_) {
        rawEntries = [];
      }

      const valid = [];
      const stale = [];

      uniqueIds.forEach((id, idx) => {
        const raw = rawEntries?.[idx];
        if (!raw) {
          stale.push(id);
          return;
        }
        let parsed = raw;
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            parsed = null;
          }
        }

        if (!parsed || typeof parsed !== 'object') {
          stale.push(id);
          return;
        }

        const name = String(parsed.playerName || '').trim();
        if (!name) {
          stale.push(id);
          return;
        }

        const numericScore = Number(parsed.score);
        if (!Number.isFinite(numericScore)) {
          stale.push(id);
          return;
        }

        valid.push({
          id,
          playerName: name,
          deptCode: parsed.deptCode || '',
          score: numericScore,
          mode: parsed.mode || fallbackMode,
          date: parsed.date || null,
        });
      });

      if (stale.length) {
        try { await kv.zrem(setKey, ...stale); } catch (_) {}
        try { await kv.zrem(keyAll, ...stale); } catch (_) {}
      }

      return valid;
    }

    const [timeAttackScoresRaw, speedRunScoresRaw] = await Promise.all([
      hydrateEntries(taIds, keyTA, 'TIME_ATTACK'),
      hydrateEntries(srIds, keySR, 'SPEED_RUN'),
    ]);

    const timeAttackScores = filterUniquePlayers(timeAttackScoresRaw, MAX_DISPLAY);
    const speedRunScores = filterUniquePlayers(speedRunScoresRaw, MAX_DISPLAY);

    const body = { timeAttackScores, speedRunScores };
    if (debug) {
      body._debug = {
        scope: scope || null,
        keyTA,
        keySR,
        provider: 'vercel-kv',
        taCount: Array.isArray(taIds) ? taIds.length : 0,
        srCount: Array.isArray(srIds) ? srIds.length : 0,
      };
    }
    return response.status(200).json(body);
  } catch (error) {
    const payload = { timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' };
    payload._err = String(error?.message || error);
    try {
      const hasUrl = !!process.env.KV_REST_API_URL;
      const hasToken = !!process.env.KV_REST_API_TOKEN;
      payload._diag = { reason: 'exception', hasUrl, hasToken };
    } catch (_) {}
    return response.status(200).json(payload);
  }
}

