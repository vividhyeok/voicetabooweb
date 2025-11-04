import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mode, score, playerName } = request.body;

  if (!mode || score === undefined || !playerName) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  const key = mode === 'TIME_ATTACK' ? 'scores:time_attack' : 'scores:speed_run';

  try {
    const newEntry = {
      playerName,
      score,
      date: new Date().toISOString(),
    };

    // For TIME_ATTACK, higher scores are better. For SPEED_RUN, lower scores are better.
    const scoreValue = mode === 'TIME_ATTACK' ? score * -1 : score; // Store negative for descending order

    // Add the new score to the sorted set
    await kv.zadd(key, { score: scoreValue, member: JSON.stringify(newEntry) });

    // Keep only the top 10
    await kv.zremrangebyrank(key, 10, -1);

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding score:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
