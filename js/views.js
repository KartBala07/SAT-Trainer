/* ============ views: home, test, tips ============ */
(function (global) {
  'use strict';
  const { esc, render, renderInline } = global.MathR;
  const S = () => global.SAT;

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const ICONS = {
    full: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M9 10v9" stroke="currentColor" stroke-width="1.7"/></svg>',
    quick: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    drill: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    ladder: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 20h4V9H4zM10 20h4V5h-4zM16 20h4v-7h-4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    review: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    read: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 5h7v15H4zM13 5h7v15h-7z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 9h2M6.5 12h2M15.5 9h2M15.5 12h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    math: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 17h16M8 3v18M16 3v18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7V16h5.6v-.5c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function diffPill(d) {
    const meta = S().DIFFS.find((x) => x.key === d) || { label: d, color: 'accent' };
    return `<span class="pill ${meta.color}">${esc(meta.label)}</span>`;
  }

  function shortDomain(d) {
    for (const k of S().SECTION_KEYS) {
      const m = S().SECTIONS[k].domains.find((x) => x.key === d);
      if (m) return m.short;
    }
    return d;
  }

  /* ---------- passage rendering ---------- */
  const U_OPEN = '\uE002';
  const U_CLOSE = '\uE003';

  function passageHTML(text) {
    if (!text) return '';
    const marked = [];
    let t = String(text).replace(/\[([^\]]+)\]/g, (_, inner) => {
      marked.push(inner);
      return `${U_OPEN}${marked.length - 1}${U_CLOSE}`;
    });
    let html = render(t);
    html = html.replace(new RegExp(`${U_OPEN}(\\d+)${U_CLOSE}`, 'g'), (_, i) => `<u>${renderInline(marked[+i])}</u>`);
    html = html.replace(/_{3,}/g, '<span class="blank"></span>');
    return html;
  }

  function passageBlock(q) {
    if (!q.passage && !q.passage2) return '';
    if (q.passage2) {
      return `<div class="passage-pair">
        <div class="passage-card"><div class="passage-lab">Text 1</div><div class="passage">${passageHTML(q.passage)}</div></div>
        <div class="passage-card"><div class="passage-lab">Text 2</div><div class="passage">${passageHTML(q.passage2)}</div></div>
      </div>`;
    }
    return `<div class="passage-card single"><div class="passage">${passageHTML(q.passage)}</div></div>`;
  }

  /* ================= HOME ================= */
  function home(state) {
    const hist = state.history || [];
    const man = state.manifest || { sections: {} };
    const rwN = (man.sections.rw || {}).count || 0;
    const mathN = (man.sections.math || {}).count || 0;
    const last = hist[0];
    const bestTotal = hist.reduce((m, h) => Math.max(m, h.total || 0), 0);
    const bestRw = hist.reduce((m, h) => Math.max(m, (h.rw && h.rw.scaled) || 0), 0);
    const bestMath = hist.reduce((m, h) => Math.max(m, (h.math && h.math.scaled) || 0), 0);
    const done = hist.reduce((s, h) => s + ((h.rw ? h.rw.total : 0) + (h.math ? h.math.total : 0)), 0);
    const settings = state.settings || {};
    const forms = settings.forms || 60;
    const form = settings.form || 1;
    const targets = [1500, 1450, 1400, 1300, 1200, 1100, 1000];
    const target = settings.target || 1500;

    const sectionCards = S().SECTION_KEYS.map((k) => {
      const c = S().SECTIONS[k];
      const n = k === 'rw' ? rwN : mathN;
      const b = k === 'rw' ? bestRw : bestMath;
      const domains = c.domains
        .map((d) => ({ ...d, n: ((man.sections[k] || {}).byDomain || {})[d.key] || 0 }))
        .filter((d) => d.n > 0);
      return `<div class="section-card">
        <div class="sc-head">
          <div class="mc-ico ${k}">${k === 'rw' ? ICONS.read : ICONS.math}</div>
          <div style="flex:1">
            <h3>${esc(c.name)}</h3>
            <div class="sc-meta">${n} questions · ${c.perModule} per module · ${Math.round(c.moduleSec / 60)} min${b ? ` · best <strong>${b}</strong>` : ''}</div>
          </div>
          <button class="btn primary" data-start="${k}">Full section ${ICONS.arrow}</button>
        </div>
        <div class="sc-actions">
          <button class="mini" data-mode="quick:${k}">${ICONS.quick}<span>Quick 10</span></button>
          <button class="mini" data-mode="ladder:${k}">${ICONS.ladder}<span>Ladder</span></button>
          ${domains.map((d) => `<button class="mini" data-drill="${k}:${esc(d.key)}">${ICONS.drill}<span>${esc(d.short)}</span><em>${d.n}</em></button>`).join('')}
        </div>
      </div>`;
    }).join('');

    return el(`<div class="wrap">
      <div class="hero">
        <div>
          <h1>Two weeks to a 1500.<br>Both sections, real format.</h1>
          <p class="sub">Full Digital SAT simulation: Reading &amp; Writing (54 questions), then Math (44), four adaptive modules, ${(rwN + mathN).toLocaleString()} practice questions. Desmos built in, every miss diagnosed.</p>
        </div>
        <div class="goal-chip">
          <div>
            <div class="g-lab">Goal</div>
            <div class="g-val">${target}</div>
          </div>
          <div class="vsep"></div>
          <div>
            <div class="g-lab">Best total</div>
            <div class="g-val" style="color:${bestTotal >= target ? 'var(--good)' : 'var(--accent-ink)'}">${bestTotal || '—'}</div>
            <div class="g-need">math + reading</div>
          </div>
        </div>
      </div>

      <div class="stat-row" style="margin-bottom:20px">
        <div class="stat"><div class="s-lab">Attempts</div><div class="s-val">${hist.length}</div><div class="s-sub">saved locally</div></div>
        <div class="stat"><div class="s-lab">Last total</div><div class="s-val">${last && last.total ? last.total : '—'}</div><div class="s-sub">${last ? new Date(last.at).toLocaleDateString() : 'no attempts yet'}</div></div>
        <div class="stat"><div class="s-lab">Best section</div><div class="s-val">${Math.max(bestRw, bestMath) || '—'}</div><div class="s-sub">${bestRw || bestMath ? (bestRw >= bestMath ? 'reading & writing' : 'math') : 'no attempts yet'}</div></div>
        <div class="stat"><div class="s-lab">Questions answered</div><div class="s-val tnum">${done.toLocaleString()}</div><div class="s-sub">across all modes</div></div>
      </div>

      <div class="mode-card feature" data-start="full" role="button" tabindex="0">
        <div class="mc-ico" style="width:52px;height:52px;border-radius:15px">${ICONS.full}</div>
        <div class="mc-body">
          <h3>Full-length test — ${forms} forms</h3>
          <p class="mc-desc">Reading &amp; Writing modules 1–2, then Math modules 1–2, with adaptive routing inside each section and a 10-minute break where the real one has it. 98 questions, 134 minutes, scored 400–1600.</p>
          <div class="mc-meta">
            <span class="pill accent">98 questions</span>
            <span class="pill">RW 32 min × 2</span>
            <span class="pill">Math 35 min × 2</span>
            <span class="pill">400–1600</span>
          </div>
        </div>
        <div class="feature-right">
          <label class="form-pick">
            <span>Form</span>
            <select id="formSelect">${Array.from({ length: forms }, (_, i) => `<option value="${i + 1}" ${i + 1 === form ? 'selected' : ''}>#${i + 1}</option>`).join('')}</select>
          </label>
          <button class="btn primary lg" data-start="full">Start test ${ICONS.arrow}</button>
        </div>
      </div>

      <div class="section-cards">${sectionCards}</div>

      <div class="home-grid two">
        <div class="mode-card" data-mode="tips" role="button" tabindex="0">
          <div class="mc-top"><div class="mc-ico">${ICONS.bulb}</div><h3>Desmos tricks &amp; timing</h3></div>
          <p class="mc-desc">The 12 calculator moves that turn five minutes of algebra into twenty seconds, plus the per-question pacing plan for both sections.</p>
          <span class="mc-go">Open the playbook ${ICONS.arrow}</span>
        </div>
        ${last && last.misses && last.misses.length ? `<div class="mode-card" data-mode="review" role="button" tabindex="0">
          <div class="mc-top"><div class="mc-ico">${ICONS.review}</div><h3>Weak-spot review</h3></div>
          <p class="mc-desc">The ${Math.min(20, last.misses.length)} questions you missed last time, in the order you missed them.</p>
          <div class="mc-meta"><span class="pill warn">${last.misses.length} misses</span><span class="pill">Untimed</span></div>
          <span class="mc-go">Review ${ICONS.arrow}</span>
        </div>` : `<div class="mode-card" style="cursor:default">
          <div class="mc-top"><div class="mc-ico">${ICONS.review}</div><h3>Weak-spot review</h3></div>
          <p class="mc-desc">After your first attempt this fills with the exact questions you missed, so you close the loop before taking another test.</p>
          <span class="faint" style="font-size:12.5px;margin-top:10px">Locked until you finish an attempt</span>
        </div>`}
      </div>

      <div class="section-h"><h2>Score history</h2><a href="#/history" style="font-size:13px">View all →</a></div>
      <div class="card panel">
        ${hist.length ? sparkline(hist.slice(0, 10).reverse()) : `<div class="empty"><div class="e-ico">◔</div>No attempts yet. Take Quick 10 in either section — fifteen minutes and you'll know where you stand.</div>`}
      </div>

      <div class="section-h"><h2>Question bank</h2></div>
      <div class="card panel">
        <div class="bank-row">
          ${S().SECTION_KEYS.map((k) => {
            const s = man.sections[k] || { byDiff: {} };
            return `<div class="bank-sec">
              <div class="bank-title">${esc(S().SECTIONS[k].name)} <span class="faint">${(s.count || 0).toLocaleString()}</span></div>
              <div class="bank-pills">
                ${S().DIFF_ORDER.map((d) => `<span class="pill ${(S().DIFFS.find((x) => x.key === d) || {}).color || ''}">${esc(S().diffLabel(d))} ${(s.byDiff || {})[d] || 0}</span>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
        <p class="p-sub" style="margin:16px 0 0;max-width:78ch">Every question is original, written to the Digital SAT's formats and difficulty curve, with each answer key verified. The real College Board items are free at <a href="https://satsuite.collegeboard.org/practice/practice-tests" target="_blank" rel="noopener">satsuite.collegeboard.org</a> — use one for your final timed dress rehearsal.</p>
      </div>
    </div>`);
  }

  function sparkline(rows) {
    return `<div class="spark-bars">
      ${rows.map((r) => {
        const score = r.total || (r.rw && r.rw.scaled) || (r.math && r.math.scaled) || 0;
        const h = Math.max(6, Math.round((score - 400) / 1200 * 100));
        const d = new Date(r.at);
        return `<div class="spark-col" title="${score} · ${r.mode || ''}">
          <div class="spark-bar" style="height:${h}%"><span class="spark-val">${score}</span></div>
          <div class="spark-date">${d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>
        </div>`;
      }).join('')}
    </div>
    <p class="faint" style="font-size:11.5px;margin-top:12px">Total score on the 400–1600 scale, oldest → newest.</p>`;
  }

  /* ================= TEST ================= */
  function test(state) {
    const a = state.attempt;
    const mod = a.modules[a.mod];
    const q = mod.questions[a.idx];
    const ans = a.answers[q.id] || {};
    const total = mod.questions.length;
    const answered = mod.questions.filter((x) => {
      const g = a.answers[x.id];
      return g && g.given != null && g.given !== '';
    }).length;
    const isRw = mod.section === 'rw';

    const choices = q.type === 'mcq'
      ? q.choices.map((c, i) => {
          const L = 'ABCD'[i];
          const crossed = (ans.crossed || []).includes(L);
          const sel = ans.given === L;
          let cls = 'choice';
          if (crossed) cls += ' crossed';
          if (sel) cls += ' selected';
          return `<button class="${cls}" data-choice="${L}">
            <span class="letter">${L}</span>
            <span class="ctext">${isRw ? render(c) : render(c)}</span>
            <span class="cross-btn" data-cross="${L}" title="Eliminate this choice">
              <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </span>
          </button>`;
        }).join('')
      : '';

    const spr = q.type === 'spr'
      ? `<div class="spr-wrap">
          <input class="spr-input" id="sprInput" inputmode="decimal" autocomplete="off" spellcheck="false"
                 placeholder="your answer" value="${esc(ans.given || '')}" />
          <div class="keypad">
            ${['7', '8', '9', '/', '4', '5', '6', '.', '1', '2', '3', '-', '0', '00', '⌫', 'C']
              .map((k) => `<button data-key="${esc(k)}">${k}</button>`).join('')}
          </div>
        </div>
        <p class="faint" style="font-size:12.5px;margin-top:10px">Student-produced response: a number, fraction (3/2), or decimal. Equivalent forms all count.</p>`
      : '';

    const nav = mod.questions.map((x, i) => {
      const g = a.answers[x.id] || {};
      let cls = 'qdot';
      if (g.given != null && g.given !== '') cls += ' answered';
      if (i === a.idx) cls += ' current';
      if (g.flagged) cls += ' flag';
      return `<button class="${cls}" data-goto="${i}">${i + 1}</button>`;
    }).join('');

    const canReveal = a.timer && a.timer.limitSec === null;

    return el(`<div class="test-shell">
      <aside class="qnav">
        <h4>${esc(mod.shortLabel || mod.label)}</h4>
        <div class="qnav-grid ${total > 24 ? 'dense' : ''}">${nav}</div>
        <div class="qnav-legend">
          <span><i class="swatch a"></i> answered · ${answered}/${total}</span>
          <span><i class="swatch f"></i> marked for review</span>
        </div>
        <button class="btn ghost" style="width:100%;margin-top:18px;justify-content:flex-start;padding:0 8px" data-quit>
          <svg viewBox="0 0 24 24" width="15" height="15"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Exit
        </button>
      </aside>

      <section class="qmain">
        <div class="qscroll">
          <div class="qinner ${isRw ? 'rw' : ''}">
            <div class="qmeta">
              <span class="qnum">Question ${a.idx + 1} of ${total}</span>
              <span class="pill" style="font-size:11px">${esc(shortDomain(q.domain))}</span>
              ${diffPill(q.difficulty)}
              ${q.type === 'spr' ? '<span class="pill" style="font-size:11px">Grid-in</span>' : ''}
            </div>
            ${isRw ? passageBlock(q) : ''}
            <div class="stem" id="stem">${render(q.stem)}</div>
            ${q.type === 'mcq' ? `<div class="choices" id="choices">${choices}</div>` : spr}
            ${state.showSolution ? solutionHTML(q) : ''}
          </div>
        </div>
        <div class="qfoot">
          <div class="qf-left">
            <button class="flag-btn ${ans.flagged ? 'on' : ''}" data-flag>
              <svg viewBox="0 0 24 24" width="15" height="15"><path d="M6 3v18M6 4h11l-1.6 4L17 12H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
              ${ans.flagged ? 'Marked' : 'Mark for review'}
            </button>
            ${canReveal ? `<button class="flag-btn" data-solution>${state.showSolution ? 'Hide solution' : 'Show solution'}</button>` : ''}
            <span class="pace" id="paceReadout"></span>
          </div>
          <div class="qf-right">
            <button class="btn" data-prev ${a.idx === 0 ? 'disabled' : ''}>Back</button>
            <button class="btn primary" data-next>${a.idx === total - 1 ? (a.mod === a.modules.length - 1 ? 'Finish' : 'Next module') : 'Next'} ${ICONS.arrow}</button>
          </div>
        </div>
      </section>
    </div>`);
  }

  function solutionHTML(q) {
    const hint = q.desmos && q.desmos.trim()
      ? `<div class="desmos-hint">
           <span class="faint" style="font-size:12px">Desmos:</span>
           <code class="desmos-code">${esc(q.desmos)}</code>
           <button class="btn ghost" style="height:30px;font-size:12.5px;padding:0 10px" data-desmos="${esc(q.desmos)}">Graph it</button>
         </div>`
      : '';
    return `<div class="solution">
      <h4>Answer &amp; explanation</h4>
      <div class="sol-body">
        <p style="margin-bottom:8px"><strong>Correct answer: ${esc(q.answer)}</strong>${q.skill ? ` <span class="faint" style="font-size:12.5px">— ${esc(q.skill)}</span>` : ''}</p>
        ${render(q.explanation || '')}
        ${q.rule ? `<p class="rule-line"><strong>Rule:</strong> ${render(q.rule)}</p>` : ''}
        ${q.skill_note ? `<p class="faint" style="font-size:13px;margin-top:10px">${render(q.skill_note)}</p>` : ''}
      </div>
      ${hint}
    </div>`;
  }

  global.Views = { home, test, solutionHTML, diffPill, shortDomain, ICONS, el, sparkline, passageHTML };
})(window);
