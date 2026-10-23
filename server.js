// 🪔 Diwali Diya Wall - zero-dependency Node server (no database, no Vercel needed)
// Everyone on the same network opens http://<your-IP>:3000 and sees the same live wall.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data.json');
const MAX = 200, COUNTDOWN_MS = 5000;

let state = { diyas: [], lit: false };
try { state = { ...state, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch {}
let countdownAt = 0;
const clients = new Set();

const lanUrls = () => Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${PORT}`);
const save = () => fs.writeFile(DATA_FILE, JSON.stringify(state), () => {});
const snapshot = () => ({ ...state, countdownAt, now: Date.now(), lan: lanUrls() });
const broadcast = () => { const m = `data: ${JSON.stringify(snapshot())}\n\n`; for (const r of clients) r.write(m); };
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const clean = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 24);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/api/state' && req.method === 'GET') return json(res, 200, snapshot());

  if (p === '/api/events' && req.method === 'GET') {          // live updates for every open browser
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }

  if (req.method === 'POST' && p.startsWith('/api/')) {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch {}

      if (p === '/api/diyas') {                                 // someone adds their name
        const name = clean(body.name);
        if (!name) return json(res, 400, { error: 'Name is required' });
        if (state.diyas.length < MAX) state.diyas.push({ id: crypto.randomUUID(), name, at: Date.now() });
        save(); broadcast(); return json(res, 201, snapshot());
      }
      if (p === '/api/light-all') {                             // 5-4-3-2-1, then every diya lights together
        if (!state.lit && !countdownAt && state.diyas.length) {
          countdownAt = Date.now() + COUNTDOWN_MS; broadcast();
          setTimeout(() => { state.lit = true; countdownAt = 0; save(); broadcast(); }, COUNTDOWN_MS);
        }
        return json(res, 200, snapshot());
      }
      if (p === '/api/clear') {                                 // reset for the next group
        state = { diyas: [], lit: false }; countdownAt = 0; save(); broadcast(); return json(res, 200, snapshot());
      }
      json(res, 404, { error: 'Not found' });
    });
    return;
  }

  const full = path.normalize(path.join(PUBLIC, p === '/' ? '/index.html' : p));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' }); res.end(data);
  });
});

setInterval(() => { for (const r of clients) r.write(': ping\n\n'); }, 20000);   // keep connections alive

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `\n  Port ${PORT} is already in use. Close the other window or run: PORT=3001 npm start\n` : e);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  🪔  Diwali Diya Wall is glowing!\n');
  console.log(`  You            : http://localhost:${PORT}`);
  const lan = lanUrls();
  if (lan.length) lan.forEach(u => console.log(`  SHARE WITH ALL : ${u}`));
  else console.log('  (No network found. Connect to Wi-Fi / LAN to let others join.)');
  console.log('\n  Everyone must be on the same Wi-Fi / office network. Press Ctrl+C to stop.\n');
});
