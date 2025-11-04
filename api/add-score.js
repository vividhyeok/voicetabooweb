import { kv } from '@vercel/kv';

// College of Education department codes
const DEPTS = {
  ko: '국어교육과',
  en: '영어교육과',
  soc: '사회교육과',
  geo: '지리교육과',
  eth: '윤리교육과',
  math: '수학교육과',
  sci: '과학교육학부',
  ce: '컴퓨터교육과',
  pe: '체육교육과',
};

function parseNameAndDept(rawName) {
  const raw = String(rawName || '').trim();
  const m = raw.match(/^(.*)&([a-zA-Z0-9_-]{1,16})$/);
  if (!m) return { name: raw, deptCode: '' };
  const name = m[1].trim();
  const code = m[2].toLowerCase();
  if (DEPTS[code]) return { name, deptCode: code };
  // Unrecognized code: ignore and keep original name as-is
  return { name: raw, deptCode: '' };
}

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
    const { name, deptCode } = parseNameAndDept(playerName);
    const newEntry = {
      playerName: name,
      deptCode, // empty string when no affiliation
      deptLabel: deptCode ? DEPTS[deptCode] : '',
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
