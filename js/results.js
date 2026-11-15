/* ============ views: results + history ============ */
(function (global) {
  'use strict';
  const { esc, render } = global.MathR;
  const { el, ICONS, shortDomain, passageHTML } = global.Views;
  const S = () => global.SAT;

  const CARELESS = new Set(['sign', 'arithmetic', 'misread', 'quantity']);

  function ring(score, min, max, opts) {
    const o = opts || {};
    const r = 76;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, (score - min) / (max - min)));
    return `<div class="ring-wrap">
      <svg width="${o.size || 196}" height="${o.size || 196}" viewBox="0 0 196 196">
        <defs>
          <linearGradient id="rg${o.id || ''}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)"/>
            <stop offset="100%" stop-color="#7aa7ff"/>
          </linearGradient>
        </defs>
        <circle cx="98" cy="98" r="${r}" fill="none" stroke="var(--line)" stroke-width="${o.stroke || 12}"/>
        <circle cx="98" cy="98" r="${r}" fill="none" stroke="url(#rg${o.id || ''})" stroke-width="${o.stroke || 12}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"
          transform="rotate(-90 98 98)" style="transition:stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)"/>
      </svg>
      <div class="ring-center">
        <div class="rc-score" style="font-size:${o.fontSize || 46}px">${score}</div>
        <div class="rc-lab">${esc(o.label || '')}</div>
      </div>
    </div>`;
  }

  function barRow(label, sub, acc, n, cls, unit, valueText) {
    const pctW = Math.round(acc * 100);
    return `<div class="bar-row">
      <div class="bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      <div class="bar-track"><div class="bar-fill ${cls || ''}" style="width:${pctW}%"></div></div>
      <div class="bv">${valueText != null ? valueText : pctW + '%'}<small>${n} ${unit || 'q'}</small></div>
    </div>`;
  }

  const accClass = (a) => (a >= 0.8 ? 'good' : a >= 0.6 ? '' : a >= 0.4 ? 'warn' : 'bad');

  function results(state) {
    const a = state.attempt;
    const secKeys = S().SECTION_KEYS.filter((k) => a.results && a.results[k]);
    const both = secKeys.length === 2;
    const total = both ? a.results.rw.scaled + a.results.math.scaled : null;
    const main = both
      ? { score: total, min: 400, max: 1600, label: 'TOTAL · 400–1600' }
      : (() => {
          const k = secKeys[0];
          return { score: a.results[k].scaled, min: 200, max: 800, label: `${S().SECTIONS[k].short.toUpperCase()} · 200–800` };
        })();
    const pct = S().percentile(both ? Math.round((total / 1600) * 800) : main.score);
    const target = (state.settings || {}).target || 1500;
    const shortfall = Math.max(0, target - main.score);

    const rawCorrect = secKeys.reduce((s, k) => s + a.results[k].correct, 0);
    const rawTotal = secKeys.reduce((s, k) => s + a.results[k].total, 0);
    const timeSec = secKeys.reduce((s, k) => s + a.results[k].analysis.totalSec, 0);
    const careless = secKeys.reduce((s, k) => s + a.results[k].analysis.carelessMisses, 0);
    const missedAll = secKeys.reduce((s, k) => s + (a.results[k].total - a.results[k].correct), 0);

    let headline;
    if (both) {
      if (total >= target) headline = `${total} — at or above your ${target} target.`;
      else headline = `${total} — ${shortfall} short of ${target}.`;
    } else {
      const k = secKeys[0];
      const sc = S().SECTIONS[k];
      const s = a.results[k].scaled;
      if (s >= 750) headline = `${sc.name}: ${s} — on pace for a 1500 total.`;
      else if (s >= 700) headline = `${sc.name}: ${s} — close to the 750 a 1500 needs.`;
      else headline = `${sc.name}: ${s} — ${750 - s} points below the 1500 pace.`;
    }

    // weakest section drives the plan
    const weakKey = secKeys.slice().sort((x, y) => a.results[x].scaled - a.results[y].scaled)[0];
    const plan = S().buildPlan(a.results[weakKey].analysis, weakKey, a.results[weakKey].scaled);

    const sectionPanels = secKeys.map((k) => {
      const sc = S().SECTIONS[k];
      const r = a.results[k];
      return `<div class="card panel">
        <div class="sec-head">
          <div class="mc-ico ${k}">${k === 'rw' ? ICONS.read : ICONS.math}</div>
          <div style="flex:1">
            <h3>${esc(sc.name)}</h3>
            <div class="p-sub" style="margin:2px 0 0">${r.correct}/${r.total} raw · ${Math.round(r.analysis.acc * 100)}% · ${r.path ? (r.path === 'hard' ? 'hard module 2' : 'standard module 2') : 'single module'}</div>
          </div>
          <div class="sec-score">${r.scaled}</div>
        </div>
        <div class="bars" style="margin-top:16px">
          ${r.analysis.domains.map((d) => barRow(shortDomain(d.key), `${d.correct}/${d.n} correct · ${Math.round(d.avgSec)}s avg`, d.acc, d.n, accClass(d.acc))).join('')}
        </div>
      </div>`;
    }).join('');

    const diffPanels = secKeys.map((k) => {
      const r = a.results[k];
      return `<div class="card panel">
        <h3>${esc(S().SECTIONS[k].short)} — difficulty curve</h3>
        <p class="p-sub">Solid through: <strong>${r.analysis.ceiling ? esc(S().diffLabel(r.analysis.ceiling)) : 'nothing yet'}</strong>${r.analysis.dropoff ? ` · breaks down at <strong>${esc(S().diffLabel(r.analysis.dropoff))}</strong>` : ''}</p>
        <div class="bars">
          ${r.analysis.diffs.map((d) => barRow(S().diffLabel(d.key), `${d.correct}/${d.n}`, d.acc, d.n, accClass(d.acc))).join('')}
        </div>
      </div>`;
    }).join('');

    const allFingerprint = (() => {
      const m = new Map();
      for (const k of secKeys) for (const f of a.results[k].analysis.fingerprint) {
        m.set(f.tag, { tag: f.tag, label: f.label, n: (m.get(f.tag) ? m.get(f.tag).n : 0) + f.n });
      }
      return [...m.values()].sort((x, y) => y.n - x.n);
    })();

    const allDiffs = (() => {
      const m = new Map();
      for (const k of secKeys) for (const d of a.results[k].analysis.diffs) {
        const cur = m.get(d.key) || { key: d.key, n: 0, correct: 0 };
        m.set(d.key, { key: d.key, n: cur.n + d.n, correct: cur.correct + d.correct });
      }
      return S().DIFF_ORDER.map((d) => m.get(d)).filter(Boolean);
    })();

    const totalSecs = secKeys.reduce((s, k) => s + a.results[k].analysis.totalSec, 0);
    const totalQs = secKeys.reduce((s, k) => s + a.results[k].analysis.total, 0);
    const avgSec = totalQs ? totalSecs / totalQs : 0;
    const pace = (state.settings || {}).pace || 88;

    const records = [];
    for (const k of secKeys) records.push(...a.results[k].records);

    return el(`<div class="wrap">
      <div class="card result-hero">
        ${ring(main.score, main.min, main.max, { label: main.label, id: 'main' })}
        <div class="rh-right">
          <div style="display:flex;gap:7px;margin-bottom:10px;flex-wrap:wrap">
            <span class="pill accent">${esc(a.modeLabel)}</span>
            ${a.form ? `<span class="pill">Form #${a.form}</span>` : ''}
            ${both ? `<span class="pill">RW ${a.results.rw.scaled}</span><span class="pill">Math ${a.results.math.scaled}</span>` : ''}
            <span class="pill">${rawTotal} questions</span>
          </div>
          <h2>${esc(headline)}</h2>
          <p class="rh-note">${rawCorrect} of ${rawTotal} correct. ${careless ? `<strong>${careless}</strong> of your ${missedAll} misses were execution errors — worth roughly <strong>+${Math.min(90, careless * 10)}</strong> points before you learn anything new. ` : ''}${both ? `Reading & Writing ${a.results.rw.scaled}, Math ${a.results.math.scaled}.` : ''}</p>
          <div class="rh-stats">
            <div class="rh-stat"><div class="rs-v">${rawCorrect}/${rawTotal}</div><div class="rs-l">Raw correct</div></div>
            <div class="rh-stat"><div class="rs-v">${Math.round((rawCorrect / Math.max(1, rawTotal)) * 100)}%</div><div class="rs-l">Accuracy</div></div>
            <div class="rh-stat"><div class="rs-v">${Math.round(avgSec)}s</div><div class="rs-l">Per question</div></div>
            <div class="rh-stat"><div class="rs-v">${fmtTime(totalSecs)}</div><div class="rs-l">Time used</div></div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:16px">${sectionPanels}</div>
      <div class="grid-2" style="margin-top:16px">${diffPanels}</div>

      <div class="grid-2" style="margin-top:16px">
        <div class="card panel">
          <h3>Why you lost points</h3>
          <p class="p-sub">Each wrong answer is tagged with the error that produced it. Execution errors are free points.</p>
          ${allFingerprint.length ? `<div class="fingerprint">
            ${allFingerprint.map((f) => `<div class="fp-row">
              <span class="fp-name">${esc(f.label)}</span>
              <span class="fp-track"><span class="fp-fill" style="display:block;width:${Math.round((f.n / Math.max(1, missedAll)) * 100)}%"></span></span>
              <span class="fp-n">${f.n}</span>
            </div>`).join('')}
          </div>
          <div style="margin-top:14px;display:flex;gap:18px;flex-wrap:wrap">
            <div><div class="tnum" style="font-weight:700;font-size:18px;color:var(--warn)">${careless}</div><div class="faint" style="font-size:11.5px">execution</div></div>
            <div><div class="tnum" style="font-weight:700;font-size:18px;color:var(--bad)">${secKeys.reduce((s, k) => s + a.results[k].analysis.knowledgeMisses, 0)}</div><div class="faint" style="font-size:11.5px">knowledge gap</div></div>
            <div><div class="tnum" style="font-weight:700;font-size:18px;color:var(--muted)">${secKeys.reduce((s, k) => s + a.results[k].analysis.blanks, 0)}</div><div class="faint" style="font-size:11.5px">left blank</div></div>
          </div>` : `<div class="empty">Clean sheet — nothing to diagnose.</div>`}
        </div>
        <div class="card panel">
          <h3>Difficulty — every question you took</h3>
          <p class="p-sub">Cumulative accuracy is what predicts 1500: you need ~85% at Hard and 60%+ at Very Hard.</p>
          <div class="bars">
            ${allDiffs.map((d) => barRow(S().diffLabel(d.key), `${d.correct}/${d.n} correct`, d.correct / Math.max(1, d.n), d.n, accClass(d.correct / Math.max(1, d.n)))).join('')}
          </div>
        </div>
      </div>

      <div class="card panel" style="margin-top:16px">
        <h3>Your 14-day plan</h3>
        <p class="p-sub">Built around <strong>${esc(S().SECTIONS[weakKey].name)}</strong>, your weaker section (${a.results[weakKey].scaled}).${both ? ` Focus areas: ${plan.focus.map((f) => `${esc(shortDomain(f.key))} ${Math.round(f.acc * 100)}%`).join(' · ')}.` : ''}</p>
        <div class="plan">
          ${plan.days.map((d) => `<div class="plan-day">
            <div class="pd-lab">${esc(d.d)}</div>
            <div>
              <div class="pd-title">${esc(d.title)}</div>
              <div class="pd-detail">${esc(d.detail)}</div>
              <div class="pd-tag">${(d.tags || []).map((t) => `<span class="pill" style="font-size:10.5px">${esc(t)}</span>`).join('')}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card panel" style="margin-top:16px">
        <h3>Question-by-question review</h3>
        <p class="p-sub">${missedAll} missed. Open one for the worked solution, what your specific answer implies, and the move that would have solved it faster.</p>
        ${missedAll ? `<div class="review-list">
          ${records.filter((r) => !r.correct).map((r) => `<div class="rev-item">
            <div class="rev-head">
              <span class="rh-n">${r.n}</span>
              <span class="rh-q">${esc(r.section === 'rw' ? 'R&W' : 'Math')} · ${esc(shortDomain(r.domain))} · ${esc(S().diffLabel(r.difficulty))}${r.skill ? ' · ' + esc(r.skill) : ''}</span>
              <span class="pill bad" style="font-size:10.5px">${r.given ? 'wrong' : 'blank'}</span>
            </div>
            <div class="rev-body">
              <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px;font-size:13.5px">
                <div><span class="faint">Your answer: </span><strong style="color:var(--bad)">${esc(r.given || '—')}</strong></div>
                <div><span class="faint">Correct: </span><strong style="color:var(--good)">${esc(r.answerText || '')}</strong></div>
                <div><span class="faint">Time: </span><strong class="tnum">${(r.ms / 1000).toFixed(0)}s</strong></div>
              </div>
              ${r.passage ? `<div class="passage-card single" style="margin-bottom:12px"><div class="passage">${passageHTML(r.passage)}</div></div>` : ''}
              <div class="stem" style="font-size:15px">${render(r.stem)}</div>
              <div class="solution" style="margin-top:14px">
                <h4>Solution</h4>
                <div class="sol-body">${render(r.explanation || '')}
                  ${r.choiceNote && r.choiceNote !== 'correct' ? `<p class="your-miss"><strong>Your answer:</strong> ${esc(r.choiceNote)}${r.errorTag ? ` <span class="faint">(${esc(S().TAG_LABEL[r.errorTag] || r.errorTag)})</span>` : ''}</p>` : ''}
                  ${r.rule ? `<p class="rule-line"><strong>Rule:</strong> ${render(r.rule)}</p>` : ''}
                </div>
                ${r.desmos ? `<div class="desmos-hint"><span class="faint" style="font-size:12px">Desmos:</span><code class="desmos-code">${esc(r.desmos)}</code><button class="btn ghost" style="height:30px;font-size:12.5px;padding:0 10px" data-desmos="${esc(r.desmos)}">Graph it</button></div>` : ''}
              </div>
            </div>
          </div>`).join('')}
        </div>` : `<div class="empty">Clean sheet. Move up a difficulty tier.</div>`}
      </div>

      ${state.schedule && global.Coach
        ? (() => {
            const next = global.Coach.nextSession(state.schedule);
            const m = state.model || { attempts: 0 };
            return `<div class="plan-update">
              <div>
                <span class="pill accent" style="font-size:10.5px">Plan updated</span>
                <h4>${esc(next ? next.title : 'Schedule rebuilt')}</h4>
                <p class="faint">${next ? `${esc(next.dow)} ${esc(next.dateLabel)} · ${next.minutes} min · ` : ''}${m.attempts} attempt${m.attempts === 1 ? '' : 's'} on record. The schedule re-cut itself around what you just missed.</p>
              </div>
              <a class="btn lg" href="#/plan">See what changed ${ICONS.arrow}</a>
            </div>`;
          })()
        : ''}

      <div style="display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap">
        <button class="btn primary lg" data-start="full">Retake full test</button>
        ${secKeys.map((k) => `<button class="btn lg" data-start="${k}">Redo ${esc(S().SECTIONS[k].short)}</button>`).join('')}
        <button class="btn lg" data-goto-history>Score history</button>
        <button class="btn ghost lg" data-home>Home</button>
      </div>
      <p class="faint" style="text-align:center;font-size:12px;margin-top:18px">Scores are estimates calibrated to the Digital SAT's 200–800 section scale, accurate to roughly ±30 points per section. The adaptive module-2 routing mirrors the real test.</p>
    </div>`);
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ================= HISTORY ================= */
  function history(state) {
    const hist = state.history || [];
    if (!hist.length) {
      return el(`<div class="wrap">
        <div class="hero"><div><h1>Score history</h1><p class="sub">Nothing here yet. Take a Quick 10 and this fills in.</p></div></div>
        <button class="btn primary" data-home>Home</button>
      </div>`);
    }
    const best = hist.reduce((m, h) => Math.max(m, h.total || 0), 0);
    const avg = Math.round(hist.reduce((s, h) => s + (h.total || 0), 0) / hist.length);
    const prev = hist[1];
    const trend = prev && hist[0].total && prev.total ? hist[0].total - prev.total : null;
    const trendColor = trend == null || trend === 0 ? 'var(--muted)' : trend > 0 ? 'var(--good)' : 'var(--bad)';

    return el(`<div class="wrap">
      <div class="hero">
        <div><h1>Score history</h1><p class="sub">Stored in this browser. The trend matters more than any single score.</p></div>
        <div class="goal-chip">
          <div><div class="g-lab">Best total</div><div class="g-val" style="color:var(--good)">${best || '—'}</div></div>
          <div class="vsep"></div>
          <div><div class="g-lab">Average</div><div class="g-val">${avg || '—'}</div></div>
          <div class="vsep"></div>
          <div><div class="g-lab">vs. previous</div><div class="g-val" style="color:${trendColor}">${trend == null ? '—' : (trend > 0 ? '+' : '') + trend}</div></div>
        </div>
      </div>
      <div class="card panel">${global.Views.sparkline(hist.slice(0, 12).reverse())}</div>
      <div class="card panel" style="margin-top:16px">
        <h3>Attempts</h3>
        <p class="p-sub">Newest first.</p>
        ${hist.map((h) => `<div class="hist-row">
          <div><div style="font-weight:600">${new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><div class="faint" style="font-size:11.5px">${new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div></div>
          <div class="h-score" style="color:var(--accent-ink)">${h.total || (h.rw && h.rw.scaled) || (h.math && h.math.scaled) || '—'}</div>
          <div class="faint" style="font-size:12.5px">${esc(h.mode || '')}${h.rw ? ` · RW ${h.rw.scaled} (${h.rw.correct}/${h.rw.total})` : ''}${h.math ? ` · Math ${h.math.scaled} (${h.math.correct}/${h.math.total})` : ''}</div>
          <div class="tnum faint" style="font-size:12.5px;text-align:right">${h.rw && h.math ? `RW ${h.rw.scaled}` : ''}</div>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
        <button class="btn primary" data-start="full">New full test</button>
        <button class="btn" data-home>Home</button>
      </div>
    </div>`);
  }

  global.Results = { results, history, ring, fmtTime };
})(window);
