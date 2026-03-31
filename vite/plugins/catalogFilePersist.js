import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(PROJECT_ROOT, 'data', 'catalog-backup.json');

function attachCatalogBackupMiddleware(server) {
  server.middlewares.use((req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (url !== '/__dev/catalog/backup' && url !== '/__dev/catalog/backup/') {
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      try {
        if (!fs.existsSync(DATA_FILE)) {
          res.statusCode = 204;
          res.end();
          return;
        }
        const buf = fs.readFileSync(DATA_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(buf);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        try {
          fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
          fs.writeFileSync(DATA_FILE, body, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e.message || e) }));
        }
      });
      return;
    }

    res.statusCode = 405;
    res.end();
  });
}

/**
 * GET/POST em `/__dev/catalog/backup` → `data/catalog-backup.json`
 * Disponível em `npm run dev` e `npm run preview` (mesma origem localhost:4173).
 */
export function catalogFilePersistPlugin() {
  return {
    name: 'catalog-file-persist',
    configureServer(server) {
      attachCatalogBackupMiddleware(server);
    },
    configurePreviewServer(server) {
      attachCatalogBackupMiddleware(server);
    },
  };
}
