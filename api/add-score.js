import { kv } from '@vercel/kv';

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

  const base = mode === 'TIME_ATTACK' ? 'scores:time_attack' : 'scores:speed_run';
  const suffix = scopeSuffix();
  const key = `${base}${suffix}`;
  const keyAll = `${base}:all${suffix}`;

  try {
    // 학과 코드는 명시적으로만 받고, 'com'만 유효
    const safeDept = assertValidDept(deptCode);
    const newEntry = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
      playerName: String(playerName).trim(),
      deptCode: safeDept, // 공란이면 미지정
      deptLabel: safeDept ? DEPTS[safeDept] : '',
      score,
      mode,
      date: new Date().toISOString(),
    };

    // For TIME_ATTACK, higher scores are better. For SPEED_RUN, lower scores are better.
    const sortScore = mode === 'TIME_ATTACK' ? score * -1 : score; // 낮을수록 상위

    // Add the new score to the sorted set (scoped)
    await kv.zadd(key, { score: sortScore, member: JSON.stringify(newEntry) });
    // 전체 플레이 기록 세트 (백분위 계산용) - 멤버를 유니크하게 유지
    await kv.zadd(keyAll, { score: sortScore, member: newEntry.id });

    // Also write to legacy (unsuffixed) keys for backward-compat/fallback during rollout
    try {
      await kv.zadd(base, { score: sortScore, member: JSON.stringify(newEntry) });
      await kv.zadd(`${base}:all`, { score: sortScore, member: newEntry.id });
    } catch (_) {}

  // Keep only the top 10 on leaderboard
  await kv.zremrangebyrank(key, 10, -1);
  try { await kv.zremrangebyrank(base, 10, -1); } catch (_) {}

    // 백분위 계산
    const total = await kv.zcard(keyAll).catch(() => 0);
    let rankIndex = null;
    try {
      // Upstash/Redis: zcount(min, max)로 현재 점수보다 "작은"(=더 우수한) 개수 계산
      // sortScore가 낮을수록 상위이므로, (-inf, sortScore) 구간 개수가 더 잘한 사람 수
      // 일부 래퍼는 exclusive를 지원하지 않을 수 있어, 동일 점수를 포함하도록 <=로 근사
      const betterOrEqual = await kv.zcount(keyAll, Number.NEGATIVE_INFINITY, sortScore);
      // 동일 점수 동률에서의 위치는 보수적으로 betterOrEqual 사용
      rankIndex = Math.max(1, betterOrEqual); // 1-based
    } catch (e) {
      // zcount 미지원 시 안전한 기본값
      rankIndex = 1;
    }
    const topPercent = total > 0 ? (rankIndex / total) * 100 : 100;

    return response.status(200).json({ success: true, entry: newEntry, stats: { total, rankIndex, topPercent } });
  } catch (error) {
    console.error('Error adding score:', error);
    const code = String(error && error.message) === 'invalid_dept' ? 400 : 500;
    return response.status(code).json({ error: code === 400 ? 'Invalid department' : 'Internal Server Error' });
  }
}
