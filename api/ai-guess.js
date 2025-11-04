export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 200 with informative error so client can show a friendly message
    return response.status(200).json({ text: 'API 키가 설정되지 않았습니다. [[모름]]', error: 'openai_key_missing' });
  }

  const { lines } = request.body || {};
  const sys = "당신은 추측 게임을 하고 있습니다. 사용자가 금지어를 사용하지 않고 숨겨진 목표어를 설명합니다. 당신은 목표어나 금지어 목록을 볼 수 없습니다.\n한국어로 간결하게 답변하세요(2문장 이하). 확신이 들면 가장 좋은 추측을 [[단어]] 형태로 포함하세요(소문자, 공백 없이).\n예시: 이것은 교통수단 같네요. [[버스]]";
  const user = `다음 설명들을 바탕으로 짧은 추론과 함께 답변해주세요. 확신이 들면 [[단어]] 형태로 추측을 포함하세요.\n설명들:\n${lines || ''}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        max_tokens: 100
      })
    });

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('OpenAI API error:', r.status, t);
      return response.status(200).json({ text: 'AI와 통신 중 오류가 발생했습니다. [[오류]]', error: 'openai_request_failed' });
    }
    const data = await r.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    return response.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error('OpenAI call failed:', e);
    return response.status(200).json({ text: 'AI와 통신 중 오류가 발생했습니다. [[오류]]', error: 'exception' });
  }
}
