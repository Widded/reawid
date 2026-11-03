import { EdgeTTS } from '@andresaya/edge-tts';

// Security Constants
const MAX_BODY_BYTES = 50 * 1024; // 50 KB body size limit
const MAX_TEXT_CHARS = 3000;      // 3,000 characters per utterance
const TTS_TIMEOUT_MS = 15000;     // 15 seconds generation timeout
const ALLOWED_VOICES = new Set(['tr-TR-AhmetNeural', 'tr-TR-EmelNeural']);

// In-Memory Rate Limiting (Sliding Window per IP)
const ipRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 45;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  let entry = ipRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipRateLimits.set(ip, entry);
    return false;
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  return false;
}

// Clean up stale rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipRateLimits.entries()) {
      if (now > entry.resetAt) ipRateLimits.delete(ip);
    }
  }, 120000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

export default async function handler(req, res) {
  // CORS Security Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. IP Rate Limiting Check
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Çok fazla seslendirme isteği gönderildi. Lütfen bir süre bekleyin.' });
  }

  // 2. Request Body Size Guard
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'İstek boyutu çok büyük (Maksimum 50KB).' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      if (body.length > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'İstek boyutu çok büyük.' });
      }
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ error: 'Geçersiz JSON verisi.' });
      }
    }

    const { text, voice = 'tr-TR-AhmetNeural', rate = 1.0 } = body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Seslendirilecek metin boş olamaz.' });
    }

    // 3. Maximum Utterance Length Guard
    const cleanText = text.trim();
    if (cleanText.length > MAX_TEXT_CHARS) {
      return res.status(400).json({
        error: `Seslendirilecek metin çok uzun (${cleanText.length} karakter). Maksimum ${MAX_TEXT_CHARS} karakter desteklenmektedir.`
      });
    }

    // 4. Voice Whitelist Validation
    const targetVoice = ALLOWED_VOICES.has(voice) ? voice : 'tr-TR-AhmetNeural';

    // 5. Speech Rate Validation (0.5x to 2.5x)
    let safeRate = 1.0;
    if (typeof rate === 'number' && rate >= 0.5 && rate <= 2.5) {
      safeRate = rate;
    }

    let rateStr = '+0%';
    if (safeRate !== 1.0) {
      const percent = Math.round((safeRate - 1.0) * 100);
      rateStr = percent >= 0 ? `+${percent}%` : `${percent}%`;
    }

    const tts = new EdgeTTS();

    // 6. Timeout Protection (15s)
    const generatePromise = tts.generate(cleanText, targetVoice, { rate: rateStr });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TTS seslendirme zaman aşımına uğradı (15s).')), TTS_TIMEOUT_MS)
    );

    const result = await Promise.race([generatePromise, timeoutPromise]);

    if (!result?.audio || result.audio.length === 0) {
      return res.status(502).json({ error: 'Ses sentezleyici ses üretemedi.' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', result.audio.length);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(result.audio);
  } catch (err) {
    console.error('[TTS Security Handler Error]:', err.message);
    const statusCode = err.message?.includes('zaman aşımına') ? 504 : 500;
    return res.status(statusCode).json({ error: err.message || 'TTS sentezleme işlemi sırasında hata oluştu.' });
  }
}
