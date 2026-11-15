#!/usr/bin/env node
/* ============================================================
   SAT Trainer — backend
   Zero dependencies: node:http, node:crypto, and either node:sqlite or a JSON
   file (see lib/store.mjs).

   Serves the static app and adds:
     GET  /healthz  /api/health   -> server + auth configuration status
     GET  /api/config             -> public client config (client id, dev flag)
     POST /api/auth/google        -> verify a Google ID token, open a session
     POST /api/auth/dev           -> dev-only session (SAT_DEV_AUTH=1)
     GET  /api/me                 -> current user
     POST /api/auth/logout        -> close the session
     GET  /api/progress           -> saved attempts for the signed-in user
     PUT  /api/progress           -> merge attempts (union), returns merged set

   Env: PORT, HOST, GOOGLE_CLIENT_ID, SAT_ALLOWED_ORIGINS, SAT_DEV_AUTH,
        SAT_STORE (sqlite|json), SAT_DATA_DIR
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { openStore } from './lib/store.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DATA = process.env.SAT_DATA_DIR || join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || process.env.SAT_HOST || '127.0.0.1';
const DEV_AUTH = process.env.SAT_DEV_AUTH === '1';
const SESSION_DAYS = 30;

/* ---------------- config ---------------- */
let cfg = { googleClientId: process.env.GOOGLE_CLIENT_ID || '', allowedOrigins: [] };
try {
  cfg = Object.assign(cfg, JSON.parse(await readFile(join(ROOT, 'config.local.json'), 'utf8')));
} catch {
  /* optional */
}
if (process.env.SAT_ALLOWED_ORIGINS) {
  cfg.allowedOrigins = process.env.SAT_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
}
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function originAllowed(origin) {
  if (!origin) return true;
  if (LOOPBACK.test(origin)) return true;
  return (cfg.allowedOrigins || []).includes(origin);
}

/* ---------------- storage ---------------- */
await mkdir(DATA, { recursive: true });
const store = await openStore(DATA);

/* ---------------- google id token verification ---------------- */
let jwksCache = { at: 0, keys: [] };

async function googleKeys() {
  if (Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('could not fetch Google signing keys');
  const json = await res.json();
  jwksCache = { at: Date.now(), keys: json.keys || [] };
  return jwksCache.keys;
}

const b64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export async function verifyGoogleToken(jwt, clientId) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, s] = parts;
  const header = JSON.parse(b64u(h).toString('utf8'));
  const payload = JSON.parse(b64u(p).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('unexpected alg');

  const keys = await googleKeys();
  const jwk = keys.find((k) => k.kid === header.kid) || keys[0];
  if (!jwk) throw new Error('no signing key');

  const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, b64u(s));
  if (!ok) throw new Error('bad signature');

  const now = Math.floor(Date.now() / 1000);
  if (!(payload.exp > now)) throw new Error('token expired');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('bad issuer');
  if (clientId && payload.aud !== clientId) throw new Error('audience mismatch');
  if (!payload.sub) throw new Error('no subject');
  return {
    sub: payload.sub,
    email: payload.email || null,
    name: payload.name || payload.given_name || null,
    picture: payload.picture || null,
  };
}

/* ---------------- helpers ---------------- */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function tokenFrom(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookies(req.headers.cookie).sat_session || null;
}

function currentUser(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const row = store.session(token);
  if (!row) return null;
  const user = store.userById(row.user_id);
  return user ? { user, token } : null;
}

function setSessionCookie(res, req, token, maxAgeSec) {
  const origin = req.headers.origin || '';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const https = proto === 'https' || origin.startsWith('https://');
  const crossSite = Boolean(origin) && !LOOPBACK.test(origin);
  const attrs = [
    `sat_session=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    `SameSite=${crossSite ? 'None' : 'Lax'}`,
  ];
  if (https || crossSite) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function openSession(req, res, profile) {
  const user = store.upsertUser(profile.sub, profile.email, profile.name, profile.picture);
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  store.newSession(token, user.id, now, now + SESSION_DAYS * 86400_000);
  store.purgeSessions();
  setSessionCookie(res, req, token, SESSION_DAYS * 86400);
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
  };
}

function normaliseAttempt(a) {
  if (!a || typeof a !== 'object' || typeof a.at !== 'number') return null;
  return {
    aid: `${a.at}:${a.modeKey || a.mode || 'attempt'}`,
    at: a.at,
    mode: String(a.mode || '').slice(0, 120),
    total: Number.isFinite(a.total) ? a.total : null,
    rw: a.rw && Number.isFinite(a.rw.scaled) ? a.rw.scaled : null,
    math: a.math && Number.isFinite(a.math.scaled) ? a.math.scaled : null,
    payload: JSON.stringify(a),
  };
}

/* ---------------- static ---------------- */
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

// Only these files under data/ are public. The account store, WAL files and
// anything else there must never be served.
const PUBLIC_DATA = new Set(['manifest.json', 'math.json', 'rw.json']);

async function serveStatic(req, res, path) {
  let rel = path === '/' ? 'index.html' : path.slice(1);
  rel = normalize(rel).replace(/^([.][.][/\\])+/, '');
  const seg = rel.split('/');
  if (seg.some((s) => s.startsWith('.') || s === 'node_modules')) return json(res, 404, { error: 'not found' });
  if (seg[0] === 'data' && !PUBLIC_DATA.has(seg.slice(1).join('/'))) {
    return json(res, 404, { error: 'not found' });
  }
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
  let st;
  try {
    st = await stat(file);
  } catch {
    return json(res, 404, { error: 'not found' });
  }
  if (st.isDirectory()) return json(res, 404, { error: 'not found' });
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': extname(file) === '.json' ? 'no-cache' : 'no-store',
  });
  createReadStream(file).pipe(res);
}

/* ---------------- server ---------------- */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = decodeURIComponent(url.pathname);
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    /* ---- health / config ---- */
    if (path === '/api/health' || path === '/healthz') {
      return json(res, 200, {
        ok: true,
        store: store.kind,
        accounts: store.countUsers(),
        authConfigured: Boolean(cfg.googleClientId) || DEV_AUTH,
        devAuth: DEV_AUTH,
      });
    }
    if (path === '/api/config') {
      return json(res, 200, {
        googleClientId: cfg.googleClientId || '',
        devAuth: DEV_AUTH,
        authConfigured: Boolean(cfg.googleClientId) || DEV_AUTH,
        store: store.kind,
      });
    }

    /* ---- auth ---- */
    if (path === '/api/auth/google' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!body.credential) return json(res, 400, { error: 'missing credential' });
      if (!cfg.googleClientId) return json(res, 501, { error: 'google sign-in is not configured on this server' });
      let profile;
      try {
        profile = await verifyGoogleToken(body.credential, cfg.googleClientId);
      } catch (e) {
        return json(res, 401, { error: `could not verify Google token: ${e.message}` });
      }
      return json(res, 200, openSession(req, res, profile));
    }

    if (path === '/api/auth/dev' && req.method === 'POST') {
      if (!DEV_AUTH) return json(res, 404, { error: 'not found' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const email = String(body.email || 'dev@localhost').slice(0, 200);
      return json(res, 200, openSession(req, res, {
        sub: `dev:${email}`,
        email,
        name: body.name || email.split('@')[0],
        picture: null,
      }));
    }

    if (path === '/api/me') {
      const cur = currentUser(req);
      if (!cur) return json(res, 401, { error: 'not signed in' });
      return json(res, 200, {
        user: { id: cur.user.id, email: cur.user.email, name: cur.user.name, picture: cur.user.picture },
        attempts: store.attempts(cur.user.id).length,
      });
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const token = tokenFrom(req);
      if (token) store.delSession(token);
      setSessionCookie(res, req, '', 0);
      return json(res, 200, { ok: true });
    }

    /* ---- profile (onboarding survey + coach state) ---- */
    if (path === '/api/profile') {
      const cur = currentUser(req);
      if (!cur) return json(res, 401, { error: 'not signed in' });
      if (req.method === 'GET') {
        return json(res, 200, { profile: store.getProfile(cur.user.id) });
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const profile = body && typeof body === 'object' ? body : {};
        if (JSON.stringify(profile).length > 200_000) return json(res, 413, { error: 'profile too large' });
        store.setProfile(cur.user.id, profile);
        return json(res, 200, { ok: true, profile: store.getProfile(cur.user.id) });
      }
      return json(res, 405, { error: 'method not allowed' });
    }

    /* ---- progress ---- */
    if (path === '/api/progress') {
      const cur = currentUser(req);
      if (!cur) return json(res, 401, { error: 'not signed in' });

      if (req.method === 'GET') {
        return json(res, 200, { attempts: store.attempts(cur.user.id) });
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const incoming = Array.isArray(body.attempts) ? body.attempts : [];
        let saved = 0;
        for (const a of incoming.slice(0, 500)) {
          const n = normaliseAttempt(a);
          if (!n) continue;
          store.upsertAttempt(cur.user.id, n);
          saved++;
        }
        return json(res, 200, { saved, attempts: store.attempts(cur.user.id) });
      }
      return json(res, 405, { error: 'method not allowed' });
    }

    /* ---- static ---- */
    return serveStatic(req, res, path);
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'server error' });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Stop the other process, or start with a different PORT.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, async () => {
  console.log(`\n  SAT Trainer`);
  console.log(`  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\n`);
  try {
    const man = JSON.parse(await readFile(join(ROOT, 'data', 'manifest.json'), 'utf8'));
    console.log(`  bank: ${man.total} questions`);
    for (const [k, s] of Object.entries(man.sections)) {
      console.log(`    ${k.padEnd(5)} ${String(s.count).padStart(5)}  ${JSON.stringify(s.byDiff)}`);
    }
  } catch {
    console.log('  ! data/manifest.json missing — run: node build-bank.mjs');
  }
  console.log(`\n  store: ${store.kind} · accounts: ${store.countUsers()} · google sign-in: ${cfg.googleClientId ? 'configured' : 'NOT configured'}`);
  if (cfg.allowedOrigins.length) console.log(`  cors origins: ${cfg.allowedOrigins.join(', ')}`);
  if (DEV_AUTH) console.log('  ⚠  SAT_DEV_AUTH=1 — anyone can sign in as anyone. Never use this in production.');
  console.log('');
});
