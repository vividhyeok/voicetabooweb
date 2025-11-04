import { createClient } from '@vercel/kv';

// 사범대 학과 라벨(허용 코드)
const DEPTS = {
  ko: '국어교육과',
  en: '영어교육과',
  soc: '사회교육과',
  geo: '지리교육과',
  eth: '윤리교육과',
  math: '수학교육과',
  sci: '과학교육학부',
  com: '컴퓨터교육과',
  pe: '체육교육과',
};

function assertValidDept(code) {
  if (!code) return '';
  const c = String(code).toLowerCase();
  if (c === 'ce') throw new Error('invalid_dept');
  if (DEPTS[c]) return c;
  throw new Error('invalid_dept');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mode, score, playerName, deptCode } = request.body || {};

  if (!mode || score === undefined || !playerName) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      return response.status(500).json({ error: 'KV store is not configured.' });
    }
    const kv = createClient({ url, token });

      const base = mode === 'TIME_ATTACK' ? 'scores_debug:time_attack' : 'scores_debug:speed_run';
      const key = base;
      const keyAll = `${base}:all`;
    const safeDept = assertValidDept(deptCode);
    const newEntry = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
      playerName: String(playerName).trim(),
      deptCode: safeDept,
      deptLabel: safeDept ? DEPTS[safeDept] : '',
      score,
      mode,
      date: new Date().toISOString(),
    };

    const sortScore = mode === 'TIME_ATTACK' ? score * -1 : score;

    await kv.zadd(key, { score: sortScore, member: newEntry.id });
    await kv.zadd(keyAll, { score: sortScore, member: newEntry.id });

    await kv.zremrangebyrank(key, 10, -1);

    const total = await kv.zcard(keyAll).catch(() => 0);
    let rankIndex = null;
    try {
      const betterOrEqual = await kv.zcount(keyAll, Number.NEGATIVE_INFINITY, sortScore);
      rankIndex = Math.max(1, betterOrEqual);
    } catch (e) {
      rankIndex = 1;
    }
    const topPercent = total > 0 ? (rankIndex / total) * 100 : 100;

    return response.status(200).json({ success: true, entry: newEntry, stats: { total, rankIndex, topPercent } });
  } catch (error) {
    console.error('Error adding score:', error);
    const code = String(error?.message) === 'invalid_dept' ? 400 : 500;
    return response.status(code).json({ error: code === 400 ? 'Invalid department' : 'Internal Server Error' });
  }
}
