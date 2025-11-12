import { createClient } from '@vercel/kv';

const MAX_DISPLAY = 10;
const FETCH_MULTIPLIER = 4;
const FETCH_LIMIT = MAX_DISPLAY * FETCH_MULTIPLIER;

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
    const baseKey = `scores${scopeSuffix}`;
    const sortedKey = `${baseKey}:time_attack`;
    const entryPrefix = `${baseKey}:entry`;

    if (!url || !token) {
      const payload = { scores: [], error: 'kv_unavailable' };
      payload._diag = { reason: 'missing_vercel_kv_credentials', hasUrl: !!url, hasToken: !!token, scope: scope || null };
      return response.status(200).json(payload);
    }

    const kv = createClient({ url, token });

    const endIndex = Math.max(0, FETCH_LIMIT - 1);
    const ids = await kv.zrange(sortedKey, 0, endIndex).catch(() => []);

    if (!Array.isArray(ids) || ids.length === 0) {
      return response.status(200).json({ scores: [] });
    }

    const entryKeys = ids.map((id) => `${entryPrefix}:${id}`);
    let rawEntries = [];
    try {
      rawEntries = await kv.mget(...entryKeys);
    } catch (error) {
      console.error('Failed to fetch leaderboard entries:', error);
      rawEntries = [];
    }

    const entries = [];
    ids.forEach((id, idx) => {
      const raw = rawEntries?.[idx];
      if (!raw) return;
      let parsed = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          parsed = null;
        }
      }
      if (!parsed || typeof parsed !== 'object') return;
      const name = String(parsed.playerName || '').trim();
      if (!name) return;
      const numericScore = Number(parsed.score);
      if (!Number.isFinite(numericScore)) return;
      entries.push({
        id,
        playerName: name,
        deptCode: parsed.deptCode || '',
        score: numericScore,
        date: parsed.date || null,
      });
    });

    const scores = filterUniquePlayers(entries, MAX_DISPLAY);
    const body = { scores };
    if (debug) {
      body._debug = {
        scope: scope || null,
        key: sortedKey,
        provider: 'vercel-kv',
        fetchedIds: Array.isArray(ids) ? ids.length : 0,
        retained: scores.length,
      };
    }
    return response.status(200).json(body);
  } catch (error) {
    const payload = { scores: [], error: 'kv_unavailable' };
    payload._err = String(error?.message || error);
    try {
      const hasUrl = !!process.env.KV_REST_API_URL;
      const hasToken = !!process.env.KV_REST_API_TOKEN;
      payload._diag = { reason: 'exception', hasUrl, hasToken };
    } catch (_) {}
    return response.status(200).json(payload);
  }
}

