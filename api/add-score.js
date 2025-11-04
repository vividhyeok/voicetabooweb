import { kv } from '@vercel/kv';

// 사범대 학과 라벨(현재 행사: 컴퓨터교육과만 사용)
const DEPTS = {
  com: '컴퓨터교육과',
};

function assertValidDept(code) {
  if (!code) return '';
  const c = String(code).toLowerCase();
  if (c === 'ce') {
    // 더 이상 'ce' 별칭은 허용하지 않음
    throw new Error('invalid_dept');
  }
  return DEPTS[c] ? c : '';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mode, score, playerName, deptCode } = request.body || {};

  if (!mode || score === undefined || !playerName) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  const key = mode === 'TIME_ATTACK' ? 'scores:time_attack' : 'scores:speed_run';
  const keyAll = mode === 'TIME_ATTACK' ? 'scores:time_attack:all' : 'scores:speed_run:all';

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

    // Add the new score to the sorted set
    await kv.zadd(key, { score: sortScore, member: JSON.stringify(newEntry) });
    // 전체 플레이 기록 세트 (백분위 계산용) - 멤버를 유니크하게 유지
    await kv.zadd(keyAll, { score: sortScore, member: newEntry.id });

    // Keep only the top 10 on leaderboard
    await kv.zremrangebyrank(key, 10, -1);

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
