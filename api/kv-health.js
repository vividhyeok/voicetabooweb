import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL || process.env.REDIS_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN,
});

export default async function handler(req, res) {
  const env = {
    has_KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    has_KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    has_UPSTASH_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    has_UPSTASH_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    has_KV_URL: !!process.env.KV_URL,
    has_REDIS_URL: !!process.env.REDIS_URL,
    prefix: process.env.KV_PREFIX || 'vtw',
    scope: process.env.LEADERBOARD_SCOPE || 'global',
  };
  try {
    const key = `${env.prefix}:health:ping`;
    await kv.set(key, Date.now(), { ex: 20 });
    const ok = await kv.get(key);
    return res.status(200).json({ ok: !!ok, env });
  } catch (e) {
    return res.status(200).json({ ok: false, env, error: String(e?.message || e) });
  }
}
