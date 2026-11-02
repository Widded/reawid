import { EdgeTTS } from '@andresaya/edge-tts';

export default async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { text, voice = 'tr-TR-AhmetNeural', rate = 1.0 } = body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Seslendirilecek metin boş olamaz' });
    }

    const tts = new EdgeTTS();

    let rateStr = '+0%';
    if (typeof rate === 'number' && rate !== 1.0) {
      const percent = Math.round((rate - 1.0) * 100);
      rateStr = percent >= 0 ? `+${percent}%` : `${percent}%`;
    }

    const targetVoice = voice === 'tr-TR-EmelNeural' ? 'tr-TR-EmelNeural' : 'tr-TR-AhmetNeural';
    const result = await tts.generate(text.trim(), targetVoice, { rate: rateStr });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', result.audio.length);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(result.audio);
  } catch (err) {
    console.error('[Vercel TTS Error]:', err);
    return res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
}
