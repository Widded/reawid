import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function setupTtsMiddleware(middlewares) {
  middlewares.use('/api/tts', async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end();
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text, voice = 'tr-TR-AhmetNeural', rate = 1.0 } = JSON.parse(body || '{}');
        if (!text || !text.trim()) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Seslendirilecek metin boş olamaz' }));
        }

        const { EdgeTTS } = await import('@andresaya/edge-tts');
        const tts = new EdgeTTS();

        let rateStr = '+0%';
        if (typeof rate === 'number' && rate !== 1.0) {
          const percent = Math.round((rate - 1.0) * 100);
          rateStr = percent >= 0 ? `+${percent}%` : `${percent}%`;
        }

        const targetVoice = voice === 'tr-TR-EmelNeural' ? 'tr-TR-EmelNeural' : 'tr-TR-AhmetNeural';
        const result = await tts.generate(text.trim(), targetVoice, { rate: rateStr });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', result.audio.length);
        res.end(result.audio);
      } catch (err) {
        console.error('[TTS Middleware Error]:', err);
        res.statusCode = 500;
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
