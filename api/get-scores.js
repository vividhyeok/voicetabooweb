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
    // Resolve KV config at request time so we can surface better diagnostics
    // Prefer matched provider pairs to avoid URL/token mismatch across providers
    const pickKvConfig = () => {
      const vercelUrl = process.env.KV_REST_API_URL;
      const vercelTokenRW = process.env.KV_REST_API_TOKEN;
      const vercelTokenRO = process.env.KV_REST_API_READ_ONLY_TOKEN;
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (vercelUrl && (vercelTokenRW || vercelTokenRO)) {
        return { url: vercelUrl, token: vercelTokenRW || vercelTokenRO, provider: 'vercel-kv' };
      }
      if (upstashUrl && upstashToken) {
        return { url: upstashUrl, token: upstashToken, provider: 'upstash' };
      }
      // Last-resort permissive fallback
      const url = vercelUrl || upstashUrl || process.env.KV_URL || process.env.REDIS_URL;
      const token = vercelTokenRW || upstashToken || vercelTokenRO;
      return { url, token, provider: 'auto' };
    };

    const { url: resolvedUrl, token: resolvedToken, provider } = pickKvConfig();

    if (!resolvedUrl || !resolvedToken) {
      const payload = { timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' };
      payload._diag = { reason: 'missing_url_or_token', hasUrl: !!resolvedUrl, hasToken: !!resolvedToken };
      return response.status(200).json(payload);
    }

  const kv = createClient({ url: resolvedUrl, token: resolvedToken });

    function scopeSuffix() {
      const scope = process.env.LEADERBOARD_SCOPE || 'day';
      if (scope === 'global') return '';
      if (scope === 'tag' && process.env.LEADERBOARD_TAG) return `:${process.env.LEADERBOARD_TAG}`;
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `:${y}${m}${day}`;
    }
    const suffix = scopeSuffix();

    // Read members only (no scores) in ascending order so "best" entries appear first.
    // We store both modes so that smaller sortScore is better; hence ascending zrange(0..9) yields Top 10.
    const keyTA = `scores:time_attack${suffix}`;
    const keySR = `scores:speed_run${suffix}`;

    let taRaw = await kv.zrange(keyTA, 0, 9).catch(() => []);
    let srRaw = await kv.zrange(keySR, 0, 9).catch(() => []);

    // Fallback to legacy keys if scoped sets are empty (for smooth rollout)
    const emptyTA = !Array.isArray(taRaw) || taRaw.length === 0;
    const emptySR = !Array.isArray(srRaw) || srRaw.length === 0;
    if (emptyTA) { try { taRaw = await kv.zrange('scores:time_attack', 0, 9); } catch (_) {} }
    if (emptySR) { try { srRaw = await kv.zrange('scores:speed_run', 0, 9); } catch (_) {} }

    const safeParse = (arr) => (Array.isArray(arr) ? arr : []).map((m) => {
      try { return JSON.parse(m); } catch { return null; }
    }).filter(Boolean);

    const timeAttackScores = safeParse(taRaw);
    const speedRunScores = safeParse(srRaw);

  const body = { timeAttackScores, speedRunScores };
  if (debug) body._debug = { suffix, keyTA, keySR, provider, taCount: taRaw?.length || 0, srCount: srRaw?.length || 0 };
    return response.status(200).json(body);
  } catch (error) {
    const payload = { timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' };
    payload._err = String(error?.message || error);
    try {
      const hasUrl = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL || process.env.REDIS_URL);
      const hasToken = !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN);
      payload._diag = { reason: 'exception', hasUrl, hasToken };
    } catch (_) {}
    return response.status(200).json(payload);
  }
}
