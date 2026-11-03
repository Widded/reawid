import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_BODY_BYTES = 50 * 1024;
const MAX_TEXT_CHARS = 3000;
const TTS_TIMEOUT_MS = 15000;
const ALLOWED_VOICES = new Set(['tr-TR-AhmetNeural', 'tr-TR-EmelNeural']);

function setupTtsMiddleware(middlewares) {
  middlewares.use('/api/tts', async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }

    let body = '';
    let bodyTooLarge = false;

    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        bodyTooLarge = true;
      }
    });

    req.on('end', async () => {
      if (bodyTooLarge) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'İstek gövdesi çok büyük (Maks 50KB)' }));
      }

      try {
        let parsed = {};
        try {
          parsed = JSON.parse(body || '{}');
        } catch (_) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Geçersiz JSON verisi' }));
        }

        const { text, voice = 'tr-TR-AhmetNeural', rate = 1.0 } = parsed;

        if (!text || typeof text !== 'string' || !text.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Seslendirilecek metin boş olamaz' }));
        }

        const cleanText = text.trim();
        if (cleanText.length > MAX_TEXT_CHARS) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: `Metin sınırı aşıldı (Maksimum ${MAX_TEXT_CHARS} karakter)` }));
        }

        const { EdgeTTS } = await import('@andresaya/edge-tts');
        const tts = new EdgeTTS();

        let safeRate = 1.0;
        if (typeof rate === 'number' && rate >= 0.5 && rate <= 2.5) {
          safeRate = rate;
        }

        let rateStr = '+0%';
        if (safeRate !== 1.0) {
          const percent = Math.round((safeRate - 1.0) * 100);
          rateStr = percent >= 0 ? `+${percent}%` : `${percent}%`;
        }

        const targetVoice = ALLOWED_VOICES.has(voice) ? voice : 'tr-TR-AhmetNeural';

        const generatePromise = tts.generate(cleanText, targetVoice, { rate: rateStr });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TTS seslendirme zaman aşımına uğradı (15s)')), TTS_TIMEOUT_MS)
        );

        const result = await Promise.race([generatePromise, timeoutPromise]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', result.audio.length);
        res.end(result.audio);
      } catch (err) {
        console.error('[TTS Middleware Error]:', err.message);
        res.statusCode = err.message?.includes('zaman aşımına') ? 504 : 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'TTS sentezleme hatası' }));
      }
    });
  });
}

export default defineConfig({
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  server: {
    host: true
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('marked') || id.includes('canvas-confetti') || id.includes('lucide')) {
              return 'vendor-ui';
            }
            return 'vendor';
          }
        }
      }
    }
  },
  plugins: [
    {
      name: 'edge-tts-api',
      configureServer(server) {
        setupTtsMiddleware(server.middlewares);
      },
      configurePreviewServer(server) {
        setupTtsMiddleware(server.middlewares);
      }
    },
    {
      name: 'icon-generator',
      configureServer(server) {
        server.middlewares.use('/api/save-logo-png', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { png192, png512 } = JSON.parse(body);
              if (png192) {
                const b192 = Buffer.from(png192.replace(/^data:image\/png;base64,/, ''), 'base64');
                fs.writeFileSync(path.resolve(__dirname, 'public/icon-192.png'), b192);
              }
              if (png512) {
                const b512 = Buffer.from(png512.replace(/^data:image\/png;base64,/, ''), 'base64');
                fs.writeFileSync(path.resolve(__dirname, 'public/icon-512.png'), b512);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });
      }
    }
  ]
});
