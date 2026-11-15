/* ============ storage ============
   Two interchangeable backends behind one interface:

     sqlite  — node:sqlite, available in Node 22.5+ (used when it loads)
     json    — a single JSON file, used when node:sqlite is unavailable or when
               SAT_STORE=json is set

   Both expose the same methods so the server never cares which is live.
   ================================= */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const DAY = 86_400_000;

/* ---------------- sqlite ---------------- */
async function openSqlite(dir) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(dir, 'accounts.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      sub TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      picture TEXT,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      user_id INTEGER NOT NULL,
      aid TEXT NOT NULL,
      at INTEGER NOT NULL,
      mode TEXT,
      total INTEGER,
      rw INTEGER,
      math INTEGER,
      payload TEXT NOT NULL,
      PRIMARY KEY (user_id, aid)
    );
    CREATE INDEX IF NOT EXISTS attempts_user_at ON attempts(user_id, at DESC);
  `);
  // profile column added later; ignore "duplicate column" on existing databases
  try { db.exec('ALTER TABLE users ADD COLUMN profile TEXT'); } catch {}

  const st = {
    upsertUser: db.prepare(`
      INSERT INTO users (sub,email,name,picture,created_at,last_seen) VALUES (?,?,?,?,?,?)
      ON CONFLICT(sub) DO UPDATE SET email=excluded.email, name=excluded.name,
        picture=excluded.picture, last_seen=excluded.last_seen RETURNING *`),
    userById: db.prepare('SELECT * FROM users WHERE id=?'),
    newSession: db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token=? AND expires_at>?'),
    delSession: db.prepare('DELETE FROM sessions WHERE token=?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at<?'),
    attempts: db.prepare('SELECT payload FROM attempts WHERE user_id=? ORDER BY at DESC LIMIT 500'),
    upsertAttempt: db.prepare(`
      INSERT INTO attempts (user_id,aid,at,mode,total,rw,math,payload) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,aid) DO UPDATE SET payload=excluded.payload, at=excluded.at,
        mode=excluded.mode, total=excluded.total, rw=excluded.rw, math=excluded.math`),
    countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
    getProfile: db.prepare('SELECT profile FROM users WHERE id=?'),
    setProfile: db.prepare('UPDATE users SET profile=? WHERE id=?'),
  };

  return {
    kind: 'sqlite',
    upsertUser(sub, email, name, picture) {
      const now = Date.now();
      return st.upsertUser.get(sub, email, name, picture, now, now);
    },
    userById: (id) => st.userById.get(id),
    newSession: (token, userId, createdAt, expiresAt) => st.newSession.run(token, userId, createdAt, expiresAt),
    session(token) {
      const row = st.session.get(token, Date.now());
      if (!row) return null;
      return { user_id: row.user_id, expires_at: row.expires_at };
    },
    delSession: (token) => st.delSession.run(token),
    purgeSessions: () => st.purgeSessions.run(Date.now()),
    attempts(userId) {
      return st.attempts.all(userId).map((r) => JSON.parse(r.payload));
    },
    upsertAttempt(userId, a) {
      st.upsertAttempt.run(userId, a.aid, a.at, a.mode, a.total, a.rw, a.math, a.payload);
    },
    countUsers: () => st.countUsers.get().n,
    getProfile(userId) {
      const row = st.getProfile.get(userId);
      if (!row || !row.profile) return null;
      try {
        return JSON.parse(row.profile);
      } catch {
        return null;
      }
    },
    setProfile(userId, value) {
      st.setProfile.run(JSON.stringify(value || {}), userId);
    },
    close() {
      try {
        db.close();
      } catch {}
    },
  };
}

/* ---------------- json ---------------- */
async function openJson(dir) {
  const file = join(dir, 'store.json');
  let data = { users: [], nextId: 1, sessions: {}, attempts: {} };
  try {
    data = Object.assign(data, JSON.parse(await readFile(file, 'utf8')));
  } catch {
    /* first run */
  }

  let writing = null;
  function flush() {
    // atomic-ish: write a temp file, then rename over the real one
    if (!writing) {
      writing = (async () => {
        const tmp = `${file}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(data));
        await rename(tmp, file);
        writing = null;
      })();
    }
    return writing;
  }

  const now = Date.now();
  for (const [token, s] of Object.entries(data.sessions)) {
    if (s.expires_at < now) delete data.sessions[token];
  }

  return {
    kind: 'json',
    upsertUser(sub, email, name, picture) {
      const t = Date.now();
      let user = data.users.find((u) => u.sub === sub);
      if (user) {
        user.email = email;
        user.name = name;
        user.picture = picture;
        user.last_seen = t;
      } else {
        user = { id: data.nextId++, sub, email, name, picture, created_at: t, last_seen: t };
        data.users.push(user);
      }
      flush();
      return user;
    },
    userById: (id) => data.users.find((u) => u.id === id) || null,
    newSession(token, userId, createdAt, expiresAt) {
      data.sessions[token] = { user_id: userId, created_at: createdAt, expires_at: expiresAt };
      flush();
    },
    session(token) {
      const s = data.sessions[token];
      if (!s || s.expires_at <= Date.now()) return null;
      return s;
    },
    delSession(token) {
      delete data.sessions[token];
      flush();
    },
    purgeSessions() {
      const t = Date.now();
      for (const [k, s] of Object.entries(data.sessions)) if (s.expires_at < t) delete data.sessions[k];
      flush();
    },
    attempts(userId) {
      const list = data.attempts[String(userId)] || [];
      return list.slice().sort((a, b) => b.at - a.at).slice(0, 500).map((r) => JSON.parse(r.payload));
    },
    upsertAttempt(userId, a) {
      const key = String(userId);
      data.attempts[key] = data.attempts[key] || [];
      const row = { aid: a.aid, at: a.at, mode: a.mode, total: a.total, rw: a.rw, math: a.math, payload: a.payload };
      const i = data.attempts[key].findIndex((r) => r.aid === a.aid);
      if (i >= 0) data.attempts[key][i] = row;
      else data.attempts[key].push(row);
      flush();
    },
    countUsers: () => data.users.length,
    getProfile(userId) {
      const u = data.users.find((x) => x.id === userId);
      return (u && u.profile) || null;
    },
    setProfile(userId, value) {
      const u = data.users.find((x) => x.id === userId);
      if (u) {
        u.profile = value || {};
        flush();
      }
    },
    close: () => flush(),
  };
}

/* ---------------- entry ---------------- */
export async function openStore(dir, preferred) {
  await mkdir(dir, { recursive: true });
  const want = preferred || process.env.SAT_STORE || '';
  if (want !== 'json') {
    try {
      return await openSqlite(dir);
    } catch (e) {
      if (want === 'sqlite') throw e;
      console.warn(`  ! node:sqlite unavailable (${e.message}) — falling back to the JSON store`);
    }
  }
  return openJson(dir);
}
