/* ============ auth + progress sync ============ */
/* Guest mode is the default: everything works from localStorage with no network.
   Signing in adds cross-device sync through the backend in server.mjs. */

(function (global) {
  'use strict';
  const cfg = Object.assign({ apiBase: '', googleClientId: '' }, global.SAT_CONFIG || {});

  /* Pin a backend at runtime so the static build can be pointed at a hosted API
     without a rebuild:  index.html?api=https://sat-trainer.onrender.com
     ?api=off clears it again. */
  const apiOverride = (() => {
    try {
      const qs = new URLSearchParams(location.search).get('api');
      if (qs === 'off' || qs === 'reset') {
        localStorage.removeItem('sat.api');
        return '';
      }
      if (qs) {
        localStorage.setItem('sat.api', qs.trim());
        return qs.trim();
      }
      return localStorage.getItem('sat.api') || '';
    } catch {
      return '';
    }
  })();
  const apiRoot = String(cfg.apiBase || apiOverride || '').replace(/\/+$/, '');
  const api = (p) => `${apiRoot}${p}`;

  const state = {
    user: null,
    token: localStorage.getItem('sat.token') || '',
    backend: false,       // backend reachable
    clientId: '',         // effective google client id
    devAuth: false,
    ready: false,
    lastSync: null,
    syncError: null,
  };
  const listeners = [];

  function emit() {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch {}
    }
    paintChip();
  }

  function headers(extra) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    if (state.token) h.Authorization = `Bearer ${state.token}`;
    return h;
  }

  async function req(path, opts = {}) {
    const res = await fetch(api(path), Object.assign({ credentials: 'include' }, opts));
    let body = null;
    try {
      body = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, body: body || {} };
  }

  /* ---------- boot ---------- */
  async function boot() {
    // If there is no backend (GitHub Pages) this fails fast and we stay in guest mode.
    try {
      const res = await fetch(api('/api/config'), { credentials: 'include', signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const c = await res.json();
        state.backend = true;
        state.clientId = cfg.googleClientId || c.googleClientId || '';
        state.devAuth = !!c.devAuth;
      }
    } catch {
      state.backend = false;
    }

    if (state.backend && state.token) {
      const me = await req('/api/me');
      if (me.ok && me.body.user) state.user = me.body.user;
      else {
        state.token = '';
        localStorage.removeItem('sat.token');
      }
    }
    if (state.backend && state.clientId) await loadGis();
    state.ready = true;
    emit();
    if (state.user) await pull();
    return state;
  }

  /* ---------- google identity services ---------- */
  let gisPromise = null;
  function loadGis() {
    if (global.google && global.google.accounts) return Promise.resolve(true);
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(!!(global.google && global.google.accounts));
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  async function handleCredential(resp) {
    if (!resp || !resp.credential) return;
    const out = await req('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: resp.credential }),
    });
    if (!out.ok) {
      state.syncError = out.body.error || 'sign-in failed';
      emit();
      return;
    }
    state.token = out.body.token;
    state.user = out.body.user;
    localStorage.setItem('sat.token', state.token);
    state.syncError = null;
    await pull();
    emit();
  }

  async function renderGoogleButton(target) {
    if (!state.clientId) return false;
    const ok = await loadGis();
    if (!ok) return false;
    global.google.accounts.id.initialize({
      client_id: state.clientId,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    });
    global.google.accounts.id.renderButton(target, {
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      width: 280,
    });
    return true;
  }

  /* ---------- dev sign-in (backend must run with SAT_DEV_AUTH=1) ---------- */
  async function signInDev(email) {
    if (!state.devAuth) return { ok: false, error: 'dev auth is off' };
    const out = await req('/api/auth/dev', {
      method: 'POST',
      body: JSON.stringify({ email: email || 'dev@localhost' }),
    });
    if (!out.ok) {
      state.syncError = out.body.error || 'dev sign-in failed';
      emit();
      return { ok: false, error: state.syncError };
    }
    state.token = out.body.token;
    state.user = out.body.user;
    localStorage.setItem('sat.token', state.token);
    await pull();
    emit();
    return { ok: true };
  }

  async function signOut() {
    if (state.backend) await req('/api/auth/logout', { method: 'POST' }).catch(() => {});
    state.token = '';
    state.user = null;
    localStorage.removeItem('sat.token');
    emit();
  }

  /* ---------- progress ---------- */
  function mergeLists(remote) {
    const key = (h) => `${h.at}:${h.modeKey || h.mode || ''}`;
    const map = new Map();
    for (const h of (global.__sat ? global.__sat.state.history : []).concat(remote || [])) {
      if (h && typeof h.at === 'number') map.set(key(h), h);
    }
    return [...map.values()].sort((a, b) => b.at - a.at).slice(0, 200);
  }

  async function pull() {
    if (!state.backend || !state.user) return;
    const out = await req('/api/progress');
    if (!out.ok) return;
    const merged = mergeLists(out.body.attempts || []);
    pushIntoApp(merged);
    // send back anything this device had that the server didn't
    await pushMany(merged);
    state.lastSync = Date.now();
    emit();
  }

  function pushIntoApp(list) {
    if (global.__sat && typeof global.__sat.adoptHistory === 'function') {
      global.__sat.adoptHistory(list);
    }
  }

  async function pushMany(list) {
    if (!state.backend || !state.user) return null;
    const out = await req('/api/progress', { method: 'PUT', body: JSON.stringify({ attempts: list }) });
    if (!out.ok) {
      state.syncError = out.body.error || 'sync failed';
      emit();
      return null;
    }
    state.syncError = null;
    return out.body.attempts || null;
  }

  // Called by the app after every finished attempt.
  async function push(attempt) {
    if (!state.backend || !state.user || !attempt) return;
    const out = await req('/api/progress', { method: 'PUT', body: JSON.stringify({ attempts: [attempt] }) });
    if (out.ok) {
      state.lastSync = Date.now();
      emit();
    } else {
      state.syncError = out.body.error || 'sync failed';
      emit();
    }
  }

  async function syncNow() {
    if (!state.backend || !state.user) return { ok: false, error: 'not signed in' };
    const local = (global.__sat ? global.__sat.state.history : []).slice();
    const mergedRemote = await pushMany(local);
    if (mergedRemote) {
      pushIntoApp(mergeLists(mergedRemote));
      state.lastSync = Date.now();
      emit();
      return { ok: true };
    }
    return { ok: false, error: state.syncError || 'sync failed' };
  }

  /* ---------- top bar chip ---------- */
  function initials(name, email) {
    const s = (name || email || 'G').trim();
    const bits = s.split(/[\s@._-]+/).filter(Boolean);
    return ((bits[0] || 'G')[0] + (bits[1] ? bits[1][0] : '')).toUpperCase();
  }

  function paintChip() {
    const chip = document.getElementById('acctChip');
    if (!chip) return;
    if (state.user) {
      const name = (state.user.name || state.user.email || 'account').split(' ')[0];
      chip.innerHTML = state.user.picture
        ? `<img src="${state.user.picture}" alt="" referrerpolicy="no-referrer" /><span>${name}</span>`
        : `<span class="acct-initials">${initials(state.user.name, state.user.email)}</span><span>${name}</span>`;
      chip.classList.add('signed');
      chip.title = `${state.user.email || ''} — synced`;
    } else {
      chip.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.8 20c.7-3.6 3.7-5.6 7.2-5.6s6.5 2 7.2 5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Guest</span>`;
      chip.classList.remove('signed');
      chip.title = state.backend
        ? 'Playing as guest — sign in to sync across devices'
        : 'Guest mode — no account needed, progress stays in this browser';
    }
  }

  /* ---------- account panel ---------- */
  function panelHTML() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (state.user) {
      return `<div class="modal-head">
          <h3>Account</h3>
          <button class="icon-btn" data-close-modal aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="acct-row">
            ${state.user.picture ? `<img class="acct-avatar" src="${state.user.picture}" alt="" referrerpolicy="no-referrer" />` : `<span class="acct-avatar initials">${initials(state.user.name, state.user.email)}</span>`}
            <div>
              <div class="acct-name">${state.user.name || 'Signed in'}</div>
              <div class="acct-email">${state.user.email || ''}</div>
            </div>
          </div>
          <p class="acct-note">${state.lastSync ? `Last synced ${new Date(state.lastSync).toLocaleTimeString()}.` : 'Not synced yet.'} ${state.syncError ? `<span style="color:var(--bad)">${state.syncError}</span>` : ''}</p>
          <div class="acct-actions">
            <button class="btn" data-auth-sync>Sync now</button>
            <button class="btn danger" data-auth-out>Sign out</button>
          </div>
          <p class="acct-foot">Signing out keeps this browser's attempts. Guest mode still works offline.</p>
        </div>`;
    }
    const googleZone = state.backend && state.clientId
      ? `<div id="gsiSlot" class="gsi-slot"></div>
         <p class="acct-foot">We only receive your name, email and avatar. Progress is stored on your own server.</p>`
      : `<div class="acct-setup">
           <div class="acct-setup-title">Sign-in isn't set up on this copy</div>
           <p>${state.backend
             ? 'The server is running, but it has no Google client ID yet.'
             : 'This is the static build, so there is no server to sign in to.'}</p>
           <details class="acct-dev">
             <summary>How to enable it</summary>
             <p>${state.backend
               ? 'Set <code>GOOGLE_CLIENT_ID</code> in the server environment (or in <code>config.local.json</code>) to a client ID whose authorised origin is this site, then restart the server.'
               : 'Run <code>node server.mjs</code> and open <code>localhost:8899</code>, or point <code>apiBase</code> in <code>js/config.js</code> at a hosted backend. Then add a Google client ID (see the README).'}</p>
           </details>
           <p class="acct-foot">Everything works without an account — that's guest mode.</p>
         </div>`;
    return `<div class="modal-head">
        <h3>Save your progress</h3>
        <button class="icon-btn" data-close-modal aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="acct-lead">You're playing as a <strong>guest</strong>. Everything works — attempts, scores, the 14-day plan — and it stays in this browser.</p>
        <p class="acct-lead">Sign in only if you want your history on more than one device.</p>
        <div class="acct-divider"><span>or</span></div>
        ${googleZone}
        <div class="acct-actions" style="margin-top:18px">
          ${state.devAuth ? `<button class="btn" data-auth-dev>Dev sign-in</button>` : ''}
          <button class="btn primary" data-auth-guest>Continue as guest</button>
        </div>
      </div>`;
  }

  async function openPanel() {
    let modal = document.getElementById('accountModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.id = 'accountModal';
      modal.hidden = true;
      modal.innerHTML = `<div class="modal acct-modal"><div id="acctBody"></div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target.id === 'accountModal' || e.target.closest('[data-close-modal]')) {
          modal.hidden = true;
        }
        const dev = e.target.closest('[data-auth-dev]');
        if (dev) signInDev('dev@localhost').then(() => (modal.hidden = true));
        const out = e.target.closest('[data-auth-out]');
        if (out) signOut().then(() => (modal.hidden = true));
        const guest = e.target.closest('[data-auth-guest]');
        if (guest) modal.hidden = true;
        const sync = e.target.closest('[data-auth-sync]');
        if (sync) {
          sync.disabled = true;
          sync.textContent = 'Syncing…';
          syncNow().then(() => {
            modal.hidden = true;
          });
        }
      });
    }
    document.getElementById('acctBody').innerHTML = panelHTML();
    modal.hidden = false;
    const slot = document.getElementById('gsiSlot');
    if (slot) {
      const ok = await renderGoogleButton(slot);
      if (!ok) slot.innerHTML = `<p class="acct-foot">Google script could not load — check your connection, then reopen this panel.</p>`;
    }
  }

  /* ---------- public ---------- */
  global.Auth = {
    state,
    boot,
    push,
    pull,
    syncNow,
    signOut,
    signInDev,
    openPanel,
    onChange: (fn) => listeners.push(fn),
    isSignedIn: () => !!state.user,
  };
})(window);
