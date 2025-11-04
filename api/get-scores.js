import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
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
    const timeAttackScoresRaw = await kv.zrange(`scores:time_attack${suffix}`, 0, 9, { withScores: true });
    const speedRunScoresRaw = await kv.zrange(`scores:speed_run${suffix}`, 0, 9, { withScores: true });

    const parseScores = (rawScores) => {
        const scores = [];
        for (let i = 0; i < rawScores.length; i += 2) {
            scores.push(JSON.parse(rawScores[i]));
        }
        return scores;
    };

    const timeAttackScores = Array.isArray(timeAttackScoresRaw) ? parseScores(timeAttackScoresRaw) : [];
    const speedRunScores = Array.isArray(speedRunScoresRaw) ? parseScores(speedRunScoresRaw) : [];

    return response.status(200).json({ timeAttackScores, speedRunScores });
  } catch (error) {
    console.error('Error fetching scores:', error);
    // Graceful fallback so UI doesn't break when KV env is missing
    return response.status(200).json({ timeAttackScores: [], speedRunScores: [], error: 'kv_unavailable' });
  }
}
