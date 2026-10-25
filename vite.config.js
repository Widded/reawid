import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  server: {
    host: true
  },
  plugins: [
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
