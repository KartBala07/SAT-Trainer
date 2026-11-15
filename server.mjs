#!/usr/bin/env node
// SAT Math Trainer — zero-dependency server
// node server.mjs  ->  http://127.0.0.1:8899

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SERVE = ROOT;
const DATA = join(ROOT, 'data');
const PACKS = join(ROOT, 'question-packs');
const PORT = Number(process.env.PORT || 8899);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

let bank = { questions: [], builtAt: null, domains: [] };

async function loadBank() {
  const files = (await readdir(PACKS)).filter((f) => f.endsWith('.json'));
  const questions = [];
  for (const f of files.sort()) {
    try {
      const raw = await readFile(join(PACKS, f), 'utf8');
      const pack = JSON.parse(raw);
      const list = Array.isArray(pack) ? pack : pack.questions || [];
      for (const q of list) {
        // normalise domain casing / ids
        q.domain = q.domain || (pack.domain ?? 'Math');
        q.source = f;
        questions.push(q);
      }
    } catch (e) {
      console.warn(`  ! skipped ${f}: ${e.message}`);
    }
  }
  const seen = new Set();
  const unique = questions.filter((q) => {
    if (!q.id || seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
  bank = {
    questions: unique,
    builtAt: new Date().toISOString(),
    domains: [...new Set(unique.map((q) => q.domain))],
    packs: files,
  };
  return bank;
}

async function jsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(DATA, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error('too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);

  try {
    // ---------- API ----------
    if (path === '/api/bank') {
      return send(res, 200, JSON.stringify(bank));
    }
    if (path === '/api/reload') {
      await loadBank();
      return send(res, 200, JSON.stringify({ ok: true, count: bank.questions.length }));
    }
    if (path === '/api/history') {
      if (req.method === 'GET') {
        const hist = await jsonFile(join(DATA, 'history.json'), []);
        return send(res, 200, JSON.stringify(hist));
      }
      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const hist = await jsonFile(join(DATA, 'history.json'), []);
        hist.unshift(body);
        await writeJson(join(DATA, 'history.json'), hist.slice(0, 100));
        return send(res, 200, JSON.stringify({ ok: true, n: hist.length }));
      }
      if (req.method === 'DELETE') {
        await writeJson(join(DATA, 'history.json'), []);
        return send(res, 200, JSON.stringify({ ok: true }));
      }
    }
    if (path === '/api/settings') {
      if (req.method === 'GET') {
        return send(res, 200, JSON.stringify(await jsonFile(join(DATA, 'settings.json'), {})));
      }
      if (req.method === 'POST') {
        await writeJson(join(DATA, 'settings.json'), JSON.parse(await readBody(req)));
        return send(res, 200, JSON.stringify({ ok: true }));
      }
    }
    if (path === '/api/health') {
      return send(res, 200, JSON.stringify({ ok: true, questions: bank.questions.length }));
    }

    // ---------- static ----------
    let rel = path === '/' ? 'index.html' : path.slice(1);
    rel = normalize(rel).replace(/^([.][.][/\\])+/, '');
    if (rel.split('/').some((seg) => seg.startsWith('.') || seg === 'node_modules')) {
      return send(res, 404, 'Not found', 'text/plain');
    }
    const file = join(SERVE, rel);
    if (!file.startsWith(SERVE)) return send(res, 403, 'forbidden', 'text/plain');
    let st;
    try {
      st = await stat(file);
    } catch {
      return send(res, 404, 'Not found', 'text/plain');
    }
    if (st.isDirectory()) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    send(res, 500, JSON.stringify({ error: String(err) }));
  }
});

await loadBank();
await mkdir(DATA, { recursive: true });

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n  SAT Trainer`);
  console.log(`  http://127.0.0.1:${PORT}\n`);
  try {
    const man = JSON.parse(await readFile(join(ROOT, 'data', 'manifest.json'), 'utf8'));
    console.log(`  bank: ${man.total} questions`);
    for (const [k, s] of Object.entries(man.sections)) {
      console.log(`    ${k.padEnd(5)} ${String(s.count).padStart(5)}  ${JSON.stringify(s.byDiff)}`);
    }
  } catch {
    console.log('  ! data/manifest.json missing — run: node build-bank.mjs');
  }
  console.log('');
});
