import { Buffer } from 'node:buffer';

const MAX_AUDIO_BASE64_LENGTH = 15 * 1024 * 1024; // ~15MB base64 payload (~11MB binary)

function guessExtension(mime) {
  if (!mime || typeof mime !== 'string') return 'webm';
  const lower = mime.toLowerCase();
  if (lower.includes('mp4')) return 'm4a';
  if (lower.includes('mpeg')) return 'mp3';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(200).json({ text: '', error: 'openai_key_missing' });
  }

  try {
    const { audio, mimeType } = request.body || {};
    if (!audio || typeof audio !== 'string') {
      return response.status(400).json({ error: 'missing_audio' });
    }
    if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
      return response.status(413).json({ error: 'audio_too_large' });
    }

    let audioBuffer;
    try {
      audioBuffer = Buffer.from(audio, 'base64');
    } catch (error) {
      console.error('Failed to decode audio payload:', error);
      return response.status(400).json({ error: 'invalid_audio' });
    }

    if (!audioBuffer || !audioBuffer.length) {
      return response.status(400).json({ error: 'empty_audio' });
    }

    const safeMime = typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm';
    const formData = new FormData();
    const filename = `speech.${guessExtension(safeMime)}`;
    const blob = new Blob([audioBuffer], { type: safeMime });
    formData.append('file', blob, filename);
    formData.append('model', 'gpt-4o-mini-transcribe');
    formData.append('response_format', 'json');
    formData.append('language', 'ko');

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => '');
      console.error('OpenAI transcription error:', openaiRes.status, text);
      return response.status(200).json({ text: '', error: 'openai_request_failed' });
    }

    const data = await openaiRes.json().catch(() => null);
    const transcript = (data && typeof data.text === 'string') ? data.text.trim() : '';

    return response.status(200).json({ text: transcript });
  } catch (error) {
    console.error('Transcription handler failed:', error);
    return response.status(500).json({ error: 'internal_error' });
  }
}
