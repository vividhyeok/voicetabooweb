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

    if (!url || !token) {
      const payload = { timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' };
      payload._diag = { reason: 'missing_vercel_kv_credentials', hasUrl: !!url, hasToken: !!token };
      return response.status(200).json(payload);
    }

    const kv = createClient({ url, token });

    const keyTA = 'scores_debug:time_attack';
    const keySR = 'scores_debug:speed_run';

    let taRaw = await kv.zrange(keyTA, 0, 9).catch(() => []);
    let srRaw = await kv.zrange(keySR, 0, 9).catch(() => []);

    const timeAttackScores = taRaw || [];
    const speedRunScores = srRaw || [];

    const body = { timeAttackScores, speedRunScores };
    if (debug) body._debug = { suffix, keyTA, keySR, provider: 'vercel-kv', taCount: taRaw?.length || 0, srCount: srRaw?.length || 0 };
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

