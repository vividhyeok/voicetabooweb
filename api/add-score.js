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

  const normalizedMode = mode === 'SPEED_RUN' ? 'SPEED_RUN' : 'TIME_ATTACK';

  const sanitizedName = String(playerName || '').trim();
  if (!sanitizedName) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  let numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return response.status(400).json({ error: 'Invalid score' });
  }
  if (normalizedMode === 'TIME_ATTACK') {
    numericScore = Math.max(0, Math.round(numericScore));
  } else {
    numericScore = Math.max(0, Math.round(numericScore * 100) / 100);
  }

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      return response.status(500).json({ error: 'KV store is not configured.' });
    }
    const kv = createClient({ url, token });

    const scope = (process.env.LEADERBOARD_SCOPE || '').trim();
    const scopeSuffix = scope ? `:${scope}` : '';
    const base = `scores_debug${scopeSuffix}`;
    const key = normalizedMode === 'TIME_ATTACK' ? `${base}:time_attack` : `${base}:speed_run`;
    const entryKey = `${base}:entry`;
    const keyAll = `${base}:all`;
    const safeDept = assertValidDept(deptCode);
    const newEntry = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
      playerName: sanitizedName.slice(0, 40),
      deptCode: safeDept,
      deptLabel: safeDept ? DEPTS[safeDept] : '',
      score: numericScore,
      mode: normalizedMode,
      date: new Date().toISOString(),
    };

    const sortScore = normalizedMode === 'TIME_ATTACK' ? numericScore * -1 : numericScore;

    await kv.zadd(key, { score: sortScore, member: newEntry.id });
    await kv.zadd(keyAll, { score: sortScore, member: newEntry.id });
    try {
      await kv.set(`${entryKey}:${newEntry.id}`, JSON.stringify(newEntry));
    } catch (error) {
      console.error('Failed to persist entry payload:', error);
    }

    await kv.zremrangebyrank(key, 10, -1);

    const totalRaw = await kv.zcard(keyAll).catch(() => 0);
    const total = Number(totalRaw) || 0;
    let rankIndex = null;
    try {
      const betterOrEqual = await kv.zcount(keyAll, '-inf', sortScore);
      rankIndex = Math.max(1, Number(betterOrEqual) || 1);
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
