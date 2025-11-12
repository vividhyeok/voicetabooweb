import { createClient } from '@vercel/kv';

const LEADERBOARD_CAP = 200;
const LEADERBOARD_NAMESPACE = 'scores_v2';

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

  const { score, playerName, deptCode } = request.body || {};

  const sanitizedName = String(playerName || '').trim();
  if (!sanitizedName) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  let numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return response.status(400).json({ error: 'Invalid score' });
  }
  numericScore = Math.max(0, Math.round(numericScore));

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      return response.status(500).json({ error: 'KV store is not configured.' });
    }
    const kv = createClient({ url, token });

    const scope = (process.env.LEADERBOARD_SCOPE || '').trim();
    const scopeSuffix = scope ? `:${scope}` : '';
    const base = `${LEADERBOARD_NAMESPACE}${scopeSuffix}`;
    const sortedKey = `${base}:time_attack`;
    const entryPrefix = `${base}:entry`;
    const safeDept = assertValidDept(deptCode);
    const normalizedKey = sanitizedName.toLowerCase();
    const memberKey = safeDept ? `${normalizedKey}::${safeDept}` : normalizedKey;
    const entryId = memberKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    const newEntry = {
      id: entryId,
      playerName: sanitizedName.slice(0, 40),
      deptCode: safeDept,
      deptLabel: safeDept ? DEPTS[safeDept] : '',
      score: numericScore,
      mode: 'TIME_ATTACK',
      date: new Date().toISOString(),
    };

    let storedEntry = newEntry;
    let appliedScore = numericScore;

    try {
      const existingRaw = await kv.get(`${entryPrefix}:${entryId}`);
      if (existingRaw) {
        let existingEntry = existingRaw;
        if (typeof existingRaw === 'string') {
          try {
            existingEntry = JSON.parse(existingRaw);
          } catch (_) {
            existingEntry = null;
          }
        }
        if (existingEntry && typeof existingEntry === 'object') {
          const existingScore = Number(existingEntry.score) || 0;
          if (existingScore >= numericScore) {
            storedEntry = existingEntry;
            appliedScore = existingScore;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to read existing leaderboard entry:', error);
    }

    const shouldUpdate = storedEntry === newEntry;

    if (shouldUpdate) {
      const sortScore = numericScore * -1;
      await kv.zadd(sortedKey, { score: sortScore, member: entryId });
      try {
        await kv.set(`${entryPrefix}:${entryId}`, JSON.stringify(newEntry));
      } catch (error) {
        console.error('Failed to persist leaderboard entry payload:', error);
      }

      try {
        await kv.zremrangebyrank(sortedKey, LEADERBOARD_CAP, -1);
      } catch (error) {
        console.warn('Failed to prune leaderboard entries:', error);
      }
    }

    const [totalRaw, rankRaw] = await Promise.all([
      kv.zcard(sortedKey).catch(() => 0),
      kv.zrank(sortedKey, entryId).catch(() => null),
    ]);

    const total = Number(totalRaw) || 0;
    const rankIndex = (typeof rankRaw === 'number' && rankRaw >= 0) ? rankRaw + 1 : null;

    return response.status(200).json({
      success: true,
      entry: storedEntry,
      stats: {
        total,
        rankIndex,
        topPercent: total > 0 && rankIndex ? (rankIndex / total) * 100 : null,
      },
      attempt: {
        score: numericScore,
        improved: shouldUpdate,
        personalBest: appliedScore,
      },
    });
  } catch (error) {
    console.error('Error adding score:', error);
    const code = String(error?.message) === 'invalid_dept' ? 400 : 500;
    return response.status(code).json({ error: code === 400 ? 'Invalid department' : 'Internal Server Error' });
  }
}
