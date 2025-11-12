import { createClient } from '@vercel/kv';

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

    const [taIds, srIds] = await Promise.all([
      kv.zrange(keyTA, 0, 9).catch(() => []),
      kv.zrange(keySR, 0, 9).catch(() => []),
    ]);

    async function hydrateEntries(ids, setKey, fallbackMode) {
      if (!Array.isArray(ids) || ids.length === 0) return [];
      const entryKeys = ids.map((id) => `${entryPrefix}:${id}`);
      let rawEntries = [];
      try {
        rawEntries = await kv.mget(...entryKeys);
      } catch (_) {
        rawEntries = [];
      }

      const valid = [];
      const stale = [];

      ids.forEach((id, idx) => {
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

    const [timeAttackScores, speedRunScores] = await Promise.all([
      hydrateEntries(taIds, keyTA, 'TIME_ATTACK'),
      hydrateEntries(srIds, keySR, 'SPEED_RUN'),
    ]);

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

