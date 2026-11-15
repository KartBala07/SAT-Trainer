/* ============ SAT Trainer — app controller ============ */
(function (global) {
  'use strict';
  const { esc } = global.MathR;
  const { el } = global.Views;
  const S = () => global.SAT;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  const state = {
    route: '#/',
    manifest: { sections: {} },
    bank: { rw: [], math: [] },
    loaded: { rw: false, math: false },
    history: [],
    settings: { target: 1500, form: 1, forms: 60 },
    attempt: null,
    showSolution: false,
    lastResults: null,
  };

  /* ---------------- storage ---------------- */
  const LS = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
  };

  function saveSettings() {
    LS.set('sat.settings', state.settings);
  }

  function saveAttempt(entry) {
    state.history.unshift(entry);
    state.history = state.history.slice(0, 200);
    LS.set('sat.history', state.history);
    if (global.Auth && global.Auth.isSignedIn()) global.Auth.push(entry);
  }

  // Called by the auth layer after a sync so both sides agree on one history.
  function adoptHistory(list) {
    if (!Array.isArray(list)) return;
    const key = (h) => `${h.at}:${h.modeKey || h.mode || ''}`;
    const map = new Map();
    for (const h of list.concat(state.history)) {
      if (h && typeof h.at === 'number') map.set(key(h), h);
    }
    state.history = [...map.values()].sort((x, y) => y.at - x.at).slice(0, 200);
    LS.set('sat.history', state.history);
    if (state.route === '#/' || state.route === '#/history') renderRoute();
  }

  /* ---------------- theme / toast ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    LS.set('sat.theme', t);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  /* ---------------- data ---------------- */
  async function loadSection(key) {
    if (state.loaded[key]) return state.bank[key];
    try {
      const res = await fetch(`data/${key}.json`, { cache: 'no-cache' });
      const json = await res.json();
      state.bank[key] = json.items || [];
      state.loaded[key] = true;
      return state.bank[key];
    } catch (e) {
      console.error('load failed', key, e);
      toast(`Could not load the ${key.toUpperCase()} question bank`);
      return [];
    }
  }

  /* ---------------- timer ---------------- */
  let lastTick = performance.now();
  let loopStarted = false;

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    lastTick = performance.now();
    setInterval(tick, 200);
  }

  function tick() {
    const now = performance.now();
    const dt = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;
    const a = state.attempt;
    if (!a || !a.timer || a.done) return;
    const t = a.timer;
    if (t.running) {
      t.elapsed += dt;
      if (t.mode === 'down') {
        t.remaining = Math.max(0, t.remaining - dt);
        if (t.remaining <= 0) {
          t.running = false;
          onTimeUp();
        }
      }
      const qid = a.modules[a.mod].questions[a.idx].id;
      a.qms[qid] = (a.qms[qid] || 0) + dt * 1000;
    }
    paintTimer();
    paintPace();
  }

  function paintTimer() {
    const a = state.attempt;
    const slot = $('#timerSlot');
    if (!slot) return;
    if (!a || !a.timer || a.done || state.route !== '#/test') {
      slot.innerHTML = '';
      return;
    }
    const t = a.timer;
    const secs = t.mode === 'down' ? t.remaining : t.elapsed;
    const cls = t.mode === 'down' ? (secs <= 60 ? 'crit' : secs <= 300 ? 'warn' : '') : '';
    const mm = Math.floor(secs / 60);
    const ss = Math.floor(secs % 60);
    slot.innerHTML = `<div class="timer ${cls}">
      <span class="t-label">${t.mode === 'down' ? 'Time left' : 'Elapsed'}</span>
      <span class="t-val">${mm}:${String(ss).padStart(2, '0')}</span>
      ${t.pausable ? `<button class="t-pause" data-pause title="${t.running ? 'Pause' : 'Resume'}">
        ${t.running
          ? '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 5v14M15 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
          : '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>'}
      </button>` : ''}
    </div>`;
  }

  function paintPace() {
    const a = state.attempt;
    const out = $('#paceReadout');
    if (!out || !a || !a.timer) return;
    const q = a.modules[a.mod].questions[a.idx];
    const sec = (a.qms[q.id] || 0) / 1000;
    const pace = a.timer.paceSec || 90;
    out.textContent = `${Math.floor(sec)}s here · pace ${Math.round(pace)}s`;
    out.style.color = sec > pace * 1.6 ? 'var(--warn)' : '';
  }

  /* ---------------- attempt lifecycle ---------------- */
  function moduleSpec(sectionKey, mod) {
    const conf = S().SECTIONS[sectionKey];
    return {
      section: sectionKey,
      mod,
      label: `Module ${mod + 1} · ${conf.perModule} questions`,
      shortLabel: `${conf.short} M${mod + 1}`,
      limitSec: conf.moduleSec,
    };
  }

  async function startAttempt(kind) {
    const parts = String(kind).split(':');
    const mode = parts[0];
    let sequence = [];
    let modeLabel = '';
    let form = null;

    if (mode === 'full') {
      form = state.settings.form || 1;
      sequence = [moduleSpec('rw', 0), moduleSpec('rw', 1), moduleSpec('math', 0), moduleSpec('math', 1)];
      modeLabel = `Full test · form #${form}`;
      await Promise.all([loadSection('rw'), loadSection('math')]);
    } else if (mode === 'rw' || mode === 'math') {
      form = state.settings.form || 1;
      sequence = [moduleSpec(mode, 0), moduleSpec(mode, 1)];
      modeLabel = `${S().SECTIONS[mode].name} section`;
      await loadSection(mode);
    }

    const a = {
      kind,
      mode,
      modeLabel,
      form,
      sequence,
      modules: [],
      mod: 0,
      idx: 0,
      answers: {},
      qms: {},
      path: {},
      results: {},
      startedAt: Date.now(),
      done: false,
      timer: null,
    };

    if (mode === 'quick' || mode === 'ladder' || mode === 'drill' || mode === 'review') {
      const sectionKey = mode === 'review' ? null : parts[1] || 'math';
      if (mode === 'review') {
        await Promise.all([loadSection('rw'), loadSection('math')]);
        const last = state.history.find((h) => h.misses && h.misses.length);
        const ids = new Set((last && last.misses) || []);
        const qs = [...state.bank.rw, ...state.bank.math].filter((q) => ids.has(q.id)).map((q) => S().shuffleChoices(q));
        const list = qs.length ? qs : S().buildQuick(state.bank.math, 'math', 10);
        a.modules = [{ section: list[0] && list[0].section ? list[0].section : 'math', mod: 0, label: 'Weak-spot review', shortLabel: 'Review', questions: list, limitSec: null }];
        a.sequence = [{}];
        modeLabel = 'Weak-spot review';
      } else {
        await loadSection(sectionKey);
        let qs;
        if (mode === 'quick') qs = S().buildQuick(state.bank[sectionKey], sectionKey, 10);
        else if (mode === 'ladder') qs = S().buildLadder(state.bank[sectionKey], sectionKey, 12);
        else qs = S().buildDrill(state.bank[sectionKey], sectionKey, parts[2], 12);
        a.modules = [{ section: sectionKey, mod: 0, label: mode === 'quick' ? 'Quick 10' : mode === 'ladder' ? 'Difficulty ladder' : parts[2], shortLabel: mode === 'quick' ? 'Quick 10' : mode === 'ladder' ? 'Ladder' : parts[2], questions: qs, limitSec: mode === 'quick' ? 15 * 60 : null }];
        a.sequence = [{}];
        modeLabel = mode === 'quick' ? `Quick 10 · ${S().SECTIONS[sectionKey].short}` : mode === 'ladder' ? `Ladder · ${S().SECTIONS[sectionKey].short}` : `Drill · ${S().SECTIONS[sectionKey].short}`;
      }
    }

    a.modeLabel = modeLabel;   // quick/ladder/drill/review set it after `a` was built
    if (!a.modules.length) {
      a.modules.push(buildModuleFor(a, 0));
    }
    if (!a.modules[0] || !a.modules[0].questions.length) {
      toast('That question set came back empty — try another mode');
      return;
    }

    state.attempt = a;
    state.showSolution = false;
    setTimerFor(a.modules[0]);
    go('#/test');
    startLoop();
    paintTimer();
  }

  function buildModuleFor(a, seqIdx) {
    const spec = a.sequence[seqIdx];
    if (!spec || !spec.section) return a.modules[a.mod];
    const sectionKey = spec.section;
    const mod = spec.mod;
    const questions = a.form
      ? S().buildFormModule(a.form, state.bank, sectionKey, mod, a.path[sectionKey])
      : S().buildModule(state.bank, sectionKey, mod === 0 ? 'm1' : 'm2easy', {});
    return Object.assign({}, spec, { questions });
  }

  function setTimerFor(mod) {
    const a = state.attempt;
    const limit = mod.limitSec;
    a.timer = {
      mode: limit ? 'down' : 'up',
      remaining: limit || 0,
      elapsed: 0,
      limitSec: limit,
      running: true,
      pausable: true,
      paceSec: limit ? limit / mod.questions.length : 90,
    };
  }

  /* ---------------- navigation ---------------- */
  function go(route) {
    if (location.hash !== route) location.hash = route;
    else {
      state.route = route;
      renderRoute();
    }
  }

  function renderRoute() {
    const view = $('#view');
    const route = state.route;
    const crumb = $('#crumb');
    $('#btnCalculator').classList.toggle('on', !$('#calcPanel').hidden);

    if (route === '#/test' && state.attempt) {
      const prevScroll = ($('.qscroll') || {}).scrollTop || 0;
      const m = state.attempt.modules[state.attempt.mod];
      crumb.textContent = m.shortLabel || m.label;
      view.innerHTML = '';
      view.appendChild(global.Views.test(state));
      const sc = $('.qscroll');
      if (sc && prevScroll) sc.scrollTop = prevScroll;
      paintTimer();
      paintPace();
      return;
    }
    if (route === '#/results' && state.lastResults) {
      crumb.textContent = 'Results';
      view.innerHTML = '';
      view.appendChild(global.Results.results(state));
      $('#timerSlot').innerHTML = '';
      return;
    }
    if (route === '#/history') {
      crumb.textContent = 'Score history';
      view.innerHTML = '';
      view.appendChild(global.Results.history(state));
      $('#timerSlot').innerHTML = '';
      return;
    }
    if (route === '#/tips') {
      crumb.textContent = 'Desmos & timing';
      view.innerHTML = '';
      view.appendChild(global.Tips.view(state));
      $('#timerSlot').innerHTML = '';
      return;
    }
    if (route === '#/break' && state.attempt) {
      crumb.textContent = 'Break';
      view.innerHTML = '';
      view.appendChild(interstitial());
      $('#timerSlot').innerHTML = '';
      return;
    }
    crumb.textContent = '';
    view.innerHTML = '';
    view.appendChild(global.Views.home(state));
    $('#timerSlot').innerHTML = '';
  }

  function interstitial() {
    const a = state.attempt;
    const next = a.sequence[a.mod];
    const built = a.modules[a.mod];
    const conf = S().SECTIONS[next.section];
    const isSectionChange = a.mod > 0 && a.sequence[a.mod - 1].section !== next.section;
    const path = a.path[next.section];
    const heading = isSectionChange
      ? `Break — then ${conf.name}`
      : `${conf.short} Module ${next.mod + 1}`;
    const body = isSectionChange
      ? `You finished Reading &amp; Writing. Stand up, look at something far away, drink water. On the real test this break is ten minutes and the clock stops — do not replay questions in your head, that module is closed.`
      : next.mod === 1
        ? (path === 'hard'
            ? 'You earned the harder second module. The questions get longer and the traps get subtler; a strong score here is worth more. Same timing as module 1.'
            : 'The second module is calibrated to how you did on module 1. Same length, same clock — target the pace you set in module 1.')
        : `Next up: ${conf.blurb}.`;

    return el(`<div class="wrap wrap-narrow" style="padding-top:56px">
      <div class="card panel" style="text-align:center;padding:44px 32px">
        <div class="pill accent" style="margin-bottom:18px">${isSectionChange ? 'Section break' : `Module ${next.mod + 1} of 2`}</div>
        <h2 style="font-size:26px;margin-bottom:10px">${esc(heading)}</h2>
        <p class="muted" style="max-width:48ch;margin:0 auto 10px">${body}</p>
        <p class="faint" style="font-size:13px;margin-bottom:24px">${built ? built.questions.length : conf.perModule} questions · ${Math.round((next.limitSec || conf.moduleSec) / 60)} minutes${a.form ? ` · form #${a.form}` : ''}</p>
        <button class="btn primary lg" data-begin-module>Begin ${esc(conf.short)} module ${next.mod + 1} →</button>
        <p class="faint" style="font-size:12px;margin-top:16px">The clock is stopped until you press begin. Desmos is in the top bar.</p>
      </div>
    </div>`);
  }

  /* ---------------- answering ---------------- */
  function currentQ() {
    const a = state.attempt;
    return a.modules[a.mod].questions[a.idx];
  }

  function answerCurrent(given) {
    const q = currentQ();
    const cur = state.attempt.answers[q.id] || {};
    state.attempt.answers[q.id] = Object.assign(cur, { given });
  }

  function setChoice(L) {
    const q = currentQ();
    if (q.type !== 'mcq') return;
    const cur = state.attempt.answers[q.id] || {};
    state.attempt.answers[q.id] = Object.assign(cur, { given: cur.given === L ? null : L });
    if (state.showSolution) state.showSolution = false;
    renderRoute();
  }

  function toggleCross(L) {
    const q = currentQ();
    const cur = state.attempt.answers[q.id] || {};
    const crossed = new Set(cur.crossed || []);
    crossed.has(L) ? crossed.delete(L) : crossed.add(L);
    state.attempt.answers[q.id] = Object.assign(cur, { crossed: [...crossed] });
    renderRoute();
  }

  function toggleFlag() {
    const q = currentQ();
    const cur = state.attempt.answers[q.id] || {};
    state.attempt.answers[q.id] = Object.assign(cur, { flagged: !cur.flagged });
    renderRoute();
  }

  function gotoIdx(i) {
    const a = state.attempt;
    a.idx = Math.max(0, Math.min(a.modules[a.mod].questions.length - 1, i));
    state.showSolution = false;
    renderRoute();
    const sc = $('.qscroll');
    if (sc) sc.scrollTop = 0;
  }

  function next() {
    const a = state.attempt;
    if (a.idx < a.modules[a.mod].questions.length - 1) return gotoIdx(a.idx + 1);
    endModule();
  }

  function prev() {
    const a = state.attempt;
    if (a.idx > 0) gotoIdx(a.idx - 1);
  }

  function onTimeUp() {
    toast("Time's up — moving on");
    endModule();
  }

  function moduleCorrect(sectionKey, modIdx) {
    const a = state.attempt;
    const m = a.modules[modIdx];
    if (!m || m.section !== sectionKey) return 0;
    return m.questions.filter((q) => {
      const g = a.answers[q.id];
      if (!g || g.given == null || g.given === '') return false;
      return q.type === 'mcq' ? g.given === q.answer : S().answersMatch(g.given, q);
    }).length;
  }

  function endModule() {
    const a = state.attempt;
    if (a.done) return;
    const cur = a.sequence[a.mod];
    const sec = cur && cur.section;

    // route the next module of this section if there is one
    if (sec && cur.mod === 0 && a.sequence[a.mod + 1] && a.sequence[a.mod + 1].section === sec) {
      const conf = S().SECTIONS[sec];
      a.path[sec] = moduleCorrect(sec, a.mod) >= conf.routeThreshold ? 'hard' : 'easy';
    }

    if (a.mod < a.sequence.length - 1) {
      a.mod += 1;
      a.idx = 0;
      a.modules[a.mod] = buildModuleFor(a, a.mod);
      setTimerFor(a.modules[a.mod]);
      a.timer.running = false;
      go('#/break');
      return;
    }
    finish();
  }

  function beginModule() {
    const a = state.attempt;
    a.timer.running = true;
    go('#/test');
  }

  function finish() {
    const a = state.attempt;
    const bySec = { rw: null, math: null };

    let n = 0;
    for (const m of a.modules) {
      if (!m || !m.section) continue;
      if (!bySec[m.section]) bySec[m.section] = { records: [], correct: 0, total: 0, path: a.path[m.section] || null };
      const bucket = bySec[m.section];
      for (const q of m.questions) {
        n++;
        const g = a.answers[q.id] || {};
        const given = g.given == null ? null : String(g.given);
        let correct = false;
        let choiceNote = null;
        let errorTag = null;
        if (q.type === 'mcq') {
          correct = given === q.answer;
          const ci = 'ABCD'.indexOf(given);
          if (ci >= 0) {
            choiceNote = q.choice_notes ? q.choice_notes[ci] : null;
            errorTag = q.error_tags ? q.error_tags[ci] : null;
          }
          if (correct) errorTag = 'none';
        } else {
          correct = given != null && S().answersMatch(given, q);
          errorTag = correct ? 'none' : given == null || given === '' ? 'blank' : 'gridin';
        }
        bucket.total++;
        if (correct) bucket.correct++;
        bucket.records.push({
          id: q.id, n, section: m.section, domain: q.domain, skill: q.skill,
          difficulty: q.difficulty, type: q.type, given, correct,
          ms: a.qms[q.id] || 0, flagged: !!g.flagged, choiceNote, errorTag,
          answerText: q.answer, stem: q.stem, explanation: q.explanation,
          desmos: q.desmos, passage: q.passage, rule: q.rule,
        });
      }
    }

    for (const key of ['rw', 'math']) {
      const b = bySec[key];
      if (!b) continue;
      const conf = S().SECTIONS[key];
      const analysis = S().analyze(b.records, { paceSec: conf.moduleSec / conf.perModule });
      const rawForScale = b.total === conf.totalQ ? b.correct : Math.round((b.correct / Math.max(1, b.total)) * conf.totalQ);
      a.results[key] = {
        scaled: S().rawToScaled(key, rawForScale, b.path),
        percentile: S().percentile(S().rawToScaled(key, rawForScale, b.path)),
        correct: b.correct,
        total: b.total,
        path: b.path,
        analysis,
        records: b.records,
      };
    }

    a.done = true;
    if (a.timer) a.timer.running = false;
    state.lastResults = true;

    const total = a.results.rw && a.results.math ? a.results.rw.scaled + a.results.math.scaled : null;
    const entry = {
      at: Date.now(),
      mode: a.modeLabel,
      modeKey: a.customMode || a.mode,
      form: a.form,
      total,
      rw: a.results.rw ? { scaled: a.results.rw.scaled, correct: a.results.rw.correct, total: a.results.rw.total, path: a.results.rw.path } : null,
      math: a.results.math ? { scaled: a.results.math.scaled, correct: a.results.math.correct, total: a.results.math.total, path: a.results.math.path } : null,
      misses: [...(a.results.rw ? a.results.rw.records : []), ...(a.results.math ? a.results.math.records : [])].filter((r) => !r.correct).map((r) => r.id),
    };
    saveAttempt(entry);
    go('#/results');
  }

  function quitAttempt() {
    if (!confirm('Exit this attempt? Nothing will be scored.')) return;
    state.attempt = null;
    state.showSolution = false;
    go('#/');
  }

  /* ---------------- calculator ---------------- */
  let desmos = null;
  let desmosLoading = false;

  function loadDesmosScript() {
    if (global.Desmos) return Promise.resolve(true);
    if (desmosLoading) return Promise.resolve(false);
    desmosLoading = true;
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
      s.async = true;
      const timer = setTimeout(() => resolve(false), 7000);
      s.onload = () => {
        clearTimeout(timer);
        resolve(!!global.Desmos);
      };
      s.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function setCalcWidth(w) {
    document.body.style.setProperty('--calc-w', w + 'px');
    const rz = $('#calcResize');
    if (rz) rz.style.left = window.innerWidth - w - 3 + 'px';
    if (desmos) desmos.resize();
  }

  async function ensureDesmos() {
    const host = $('#desmosHost');
    if (desmos) return true;
    const ok = await loadDesmosScript();
    if (!ok || !global.Desmos) {
      host.innerHTML = `<iframe src="https://www.desmos.com/calculator" style="width:100%;height:100%;border:0" title="Desmos"></iframe>`;
      host.dataset.fallback = '1';
      return false;
    }
    try {
      desmos = global.Desmos.GraphingCalculator(host, {
        expressions: true, keypad: true, graphpaper: true, settingsMenu: true, zoomButtons: true, border: false,
      });
      host.dataset.fallback = '0';
      return true;
    } catch (e) {
      host.innerHTML = `<iframe src="https://www.desmos.com/calculator" style="width:100%;height:100%;border:0" title="Desmos"></iframe>`;
      host.dataset.fallback = '1';
      return false;
    }
  }

  async function openCalc() {
    const panel = $('#calcPanel');
    if (panel.hidden) setCalcWidth(Math.min(560, Math.round(window.innerWidth * 0.46)));
    panel.hidden = false;
    document.body.classList.add('calc-open');
    const rz = $('#calcResize');
    rz.hidden = false;
    rz.style.left = window.innerWidth - panel.offsetWidth - 3 + 'px';
    $('#btnCalculator').classList.add('on');
    await ensureDesmos();
    if (desmos) setTimeout(() => desmos.resize(), 60);
  }

  function closeCalc() {
    $('#calcPanel').hidden = true;
    $('#calcResize').hidden = true;
    document.body.classList.remove('calc-open');
    $('#btnCalculator').classList.remove('on');
  }

  function toggleCalc() {
    if ($('#calcPanel').hidden) openCalc();
    else closeCalc();
  }

  async function graphExpression(expr) {
    await openCalc();
    switchCalcTab('graph');
    if (desmos) {
      try {
        const lines = String(expr).split('\n').filter(Boolean);
        lines.forEach((l, i) => desmos.setExpression({ id: `hint${i}`, latex: l }));
        desmos.setMathBounds({ left: -10, right: 10, bottom: -10, top: 10 });
      } catch (e) {
        copy(expr);
        toast('Copied — paste it into Desmos');
      }
    } else {
      copy(expr);
      toast('Copied — paste it into Desmos');
    }
  }

  function copy(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  function switchCalcTab(which) {
    $$('.calc-tab').forEach((b) => b.classList.toggle('active', b.dataset.calc === which));
    const host = $('#desmosHost');
    const sci = $('#sciHost');
    if (which === 'graph') {
      host.hidden = false;
      sci.hidden = true;
      if (desmos) setTimeout(() => desmos.resize(), 40);
    } else {
      host.hidden = true;
      sci.hidden = false;
      if (!sci.dataset.init) {
        sci.innerHTML = sciCalcHTML();
        sci.dataset.init = '1';
        bindSciCalc(sci);
      }
    }
  }

  function sciCalcHTML() {
    const keys = [
      ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['ln(', 'ln'], ['log(', 'log'],
      ['sqrt(', '√'], ['^2', 'x²'], ['^', 'xʸ'], ['(', '('], [')', ')'],
      ['7', '7'], ['8', '8'], ['9', '9'], ['/', '÷'], ['back', 'DEL'],
      ['4', '4'], ['5', '5'], ['6', '6'], ['*', '×'], ['clear', 'C'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['-', '−'], ['pi', 'π'],
      ['0', '0'], ['.', '.'], ['e', 'e'], ['+', '+'], ['eq', '='],
    ];
    return `<div class="sci">
      <div class="sci-disp"><div class="e" id="sciExpr"></div><div class="v" id="sciVal">0</div></div>
      <div class="sci-keys">
        ${keys.map(([k, label]) => {
          const cls = k === 'eq' ? 'eq' : ['+', '-', '*', '/', '^', '(', ')', 'sqrt(', 'sin(', 'cos(', 'tan(', 'ln(', 'log(', 'pi', 'e', '^2'].includes(k) ? 'op' : '';
          return `<button class="${cls}" data-sci="${esc(k)}">${label}</button>`;
        }).join('')}
      </div>
    </div>`;
  }

  function bindSciCalc(root) {
    let expr = '';
    let lastExpr = '';
    let lastResult = null;
    const exprEl = $('#sciExpr', root);
    const valEl = $('#sciVal', root);

    const evaluate = () => {
      if (!expr.trim()) return null;
      let js = expr
        .replace(/pi/g, 'Math.PI')
        .replace(/\be\b/g, 'Math.E')
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/\^/g, '**');
      if (!/^[0-9+\-*/(). Matha-z]*$/.test(js)) return null;
      try {
        const v = Function(`"use strict";return (${js});`)();
        return typeof v === 'number' && isFinite(v) ? v : null;
      } catch {
        return null;
      }
    };

    const paint = () => {
      exprEl.textContent = expr || (lastExpr ? lastExpr + ' =' : '');
      const v = expr ? evaluate() : lastResult;
      valEl.textContent = v == null ? '0' : String(Math.round(v * 1e10) / 1e10);
    };

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sci]');
      if (!b) return;
      const k = b.dataset.sci;
      if (k === 'clear') {
        expr = '';
        lastExpr = '';
        lastResult = null;
      } else if (k === 'back') {
        expr = expr.slice(0, -1);
      } else if (k === 'eq') {
        const v = evaluate();
        if (v != null) {
          lastExpr = expr;
          lastResult = v;
          expr = '';
        }
      } else {
        if (expr === '' && lastResult != null && /^[+\-*/^]/.test(k)) expr = String(lastResult);
        expr += k;
      }
      paint();
    });
    paint();
  }

  /* ---------------- reference sheet ---------------- */
  function refSheetHTML() {
    const F = (label, tex) => `<div class="ref-item"><div class="ri-lab">${esc(label)}</div><div>${global.MathR.renderInline(`$$${tex}$$`)}</div></div>`;
    return [
      F('Area of a circle', 'A=\\pi r^{2}'),
      F('Circumference', 'C=2\\pi r'),
      F('Area of a triangle', 'A=\\tfrac{1}{2}bh'),
      F('Pythagorean theorem', 'a^{2}+b^{2}=c^{2}'),
      F('45–45–90 triangle', 'x,\\; x,\\; x\\sqrt{2}'),
      F('30–60–90 triangle', 'x,\\; x\\sqrt{3},\\; 2x'),
      F('Volume, cylinder', 'V=\\pi r^{2}h'),
      F('Volume, sphere', 'V=\\tfrac{4}{3}\\pi r^{3}'),
      F('Volume, cone', 'V=\\tfrac{1}{3}\\pi r^{2}h'),
      F('Volume, pyramid', 'V=\\tfrac{1}{3}Bh'),
      F('Degrees in a circle', '360^{\\circ}=2\\pi\\ \\text{radians}'),
      F('Angles in a triangle', '180^{\\circ}'),
    ].join('');
  }

  /* ---------------- events ---------------- */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      const closest = (sel) => t.closest(sel);

      const start = closest('[data-start]');
      if (start) return startAttempt(start.dataset.start);

      let m = closest('[data-mode]');
      if (m) {
        if (m.dataset.mode === 'tips') return go('#/tips');
        return startAttempt(m.dataset.mode);
      }
      m = closest('[data-drill]');
      if (m) {
        const [sec, ...dom] = m.dataset.drill.split(':');
        return startAttempt(`drill:${sec}:${dom.join(':')}`);
      }
      if (closest('[data-home]')) return go('#/');
      if (closest('[data-goto-history]')) return go('#/history');

      if (closest('[data-edit-rw]')) {
        const cur = state.settings.target || 1500;
        const v = prompt('What total score are you aiming for? (400-1600)', String(cur));
        if (v != null) {
          state.settings.target = Math.max(400, Math.min(1600, parseInt(v, 10) || cur));
          saveSettings();
          renderRoute();
        }
        return;
      }

      const crossBtn = closest('[data-cross]');
      if (crossBtn) {
        e.stopPropagation();
        return toggleCross(crossBtn.dataset.cross);
      }
      const choice = closest('[data-choice]');
      if (choice) return setChoice(choice.dataset.choice);
      const key = closest('[data-key]');
      if (key) {
        const input = $('#sprInput');
        if (input) {
          const k = key.dataset.key;
          if (k === '⌫') input.value = input.value.slice(0, -1);
          else if (k === 'C') input.value = '';
          else input.value += k;
          answerCurrent(input.value);
        }
        return;
      }
      if (closest('[data-solution]')) {
        state.showSolution = !state.showSolution;
        return renderRoute();
      }
      if (closest('[data-flag]')) return toggleFlag();
      if (closest('[data-prev]')) return prev();
      if (closest('[data-next]')) return next();
      if (closest('[data-goto]')) return gotoIdx(Number(closest('[data-goto]').dataset.goto));
      if (closest('[data-quit]')) return quitAttempt();
      if (closest('[data-begin-module]')) return beginModule();
      if (closest('[data-pause]')) {
        const a = state.attempt;
        if (a && a.timer.pausable) {
          a.timer.running = !a.timer.running;
          paintTimer();
        }
        return;
      }
      if (closest('[data-desmos]')) return graphExpression(closest('[data-desmos]').dataset.desmos);
      if (closest('[data-close-modal]')) {
        $('#refModal').hidden = true;
        return;
      }
      const revHead = closest('.rev-head');
      if (revHead) return revHead.parentElement.classList.toggle('open');
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'formSelect') {
        state.settings.form = Number(e.target.value) || 1;
        saveSettings();
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'sprInput') {
        answerCurrent(e.target.value);
        paintPace();
      }
    });

    const acct = $('#acctChip');
    if (acct) acct.addEventListener('click', () => global.Auth && global.Auth.openPanel());

    $('#btnTheme').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(cur);
      if (desmos && desmos.updateSettings) desmos.updateSettings({ invertedColors: cur === 'dark' });
      renderRoute();
    });

    $('#btnCalculator').addEventListener('click', toggleCalc);
    $('#btnCalcClose').addEventListener('click', closeCalc);
    $('#btnReference').addEventListener('click', () => {
      $('#refBody').innerHTML = refSheetHTML();
      $('#refModal').hidden = false;
    });
    $('#refModal').addEventListener('click', (e) => {
      if (e.target.id === 'refModal') $('#refModal').hidden = true;
    });
    $$('.calc-tab').forEach((b) => b.addEventListener('click', () => switchCalcTab(b.dataset.calc)));

    const rz = $('#calcResize');
    let dragging = false;
    rz.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      setCalcWidth(Math.max(340, Math.min(window.innerWidth - 320, window.innerWidth - e.clientX)));
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.cursor = '';
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Enter' && e.target.id === 'sprInput') $('#view').querySelector('[data-next]')?.click();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = state.attempt;
      if (state.route === '#/test' && a) {
        const q = a.modules[a.mod].questions[a.idx];
        const map = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const k = e.key.toLowerCase();
        if (map[k] && q.type === 'mcq') {
          e.preventDefault();
          return setChoice(map[k]);
        }
        if (e.key === 'ArrowRight') return next();
        if (e.key === 'ArrowLeft') return prev();
        if (k === 'f') return toggleFlag();
      }
      if (e.key === 'Escape') {
        $('#refModal').hidden = true;
        if (!$('#calcPanel').hidden) closeCalc();
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        $('#btnReference').click();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleCalc();
      }
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    applyTheme(LS.get('sat.theme', 'light'));
    state.settings = Object.assign({ target: 1500, form: 1, forms: 60 }, LS.get('sat.settings', {}));
    state.history = LS.get('sat.history', []);

    bindGlobal();
    startLoop();

    window.addEventListener('hashchange', () => {
      state.route = location.hash || '#/';
      renderRoute();
    });

    try {
      const res = await fetch('data/manifest.json', { cache: 'no-cache' });
      state.manifest = await res.json();
    } catch (e) {
      console.error('manifest failed', e);
      toast('Question bank manifest missing — run: node build-bank.mjs');
    }

    if (global.Auth) {
      try {
        await global.Auth.boot();
      } catch (e) {
        console.error('auth boot failed', e);
      }
    }

    state.route = location.hash || '#/';
    if (!location.hash) location.hash = '#/';
    renderRoute();
    setTimeout(() => loadDesmosScript(), 900);
  }

  document.addEventListener('DOMContentLoaded', boot);
  global.__sat = { state, startAttempt, go, graphExpression, loadSection, adoptHistory };
})(window);
