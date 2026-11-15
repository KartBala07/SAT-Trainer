/* ============ views: onboarding survey + plan ============ */
(function (global) {
  'use strict';
  const { esc } = global.MathR;
  const { el, ICONS } = global.Views;
  const C = () => global.Coach;
  const S = () => global.SAT;

  const KIND_LABEL = {
    repair: 'Repair',
    sharpen: 'Sharpen',
    rehearse: 'Rehearse',
    full: 'Full test',
    light: 'Light',
    taper: 'Taper',
  };
  const KIND_CLASS = {
    repair: 'warn',
    sharpen: 'accent',
    rehearse: 'violet',
    full: 'bad',
    light: '',
    taper: 'good',
  };

  /* ---------------- survey ---------------- */
  function survey(state) {
    const plan = Object.assign(C().defaultPlan(), state.settings.plan || {});
    const days = new Set(Array.isArray(plan.days) ? plan.days : [1, 2, 3, 4, 5]);
    const until = C().daysUntil(plan);

    return el(`<div class="wrap wrap-narrow">
      <div class="hero" style="margin-bottom:18px">
        <div>
          <h1>Build your plan</h1>
          <p class="sub">Four questions. The answers decide how the schedule is cut — which days, how long, and how close to the test the hard work sits.</p>
        </div>
      </div>

      <div class="card panel">
        <div class="setup-step">
          <label class="setup-label">1 · When is your test?</label>
          <div class="setup-row">
            <input type="date" id="planDate" class="setup-input" value="${esc(plan.testDate)}" />
            ${[14, 21, 30].map((n) => `<button class="mini" data-plan-quick="${n}">in ${n} days</button>`).join('')}
          </div>
          <div class="setup-hint" id="planDateHint">${until != null ? `${until} day${until === 1 ? '' : 's'} from today` : ''}</div>
        </div>

        <div class="setup-step">
          <label class="setup-label">2 · Which days can you study?</label>
          <div class="setup-row" id="planDays">
            ${C().WD.map((d, i) => `<button class="day-chip ${days.has(i) ? 'on' : ''}" data-plan-day="${i}">${d}</button>`).join('')}
          </div>
          <div class="setup-hint">Pick the days you'll actually show up. Two honest days beat six optimistic ones.</div>
        </div>

        <div class="setup-step">
          <label class="setup-label">3 · How long is one session?</label>
          <div class="setup-row" id="planMinutes">
            ${[25, 45, 60, 90, 120].map((m) => `<button class="day-chip ${Number(plan.minutes) === m ? 'on' : ''}" data-plan-minutes="${m}">${m} min${m >= 120 ? ' · full test' : ''}</button>`).join('')}
          </div>
          <div class="setup-hint">A full-length test needs 134 minutes, so it only appears if you have a 2-hour slot.</div>
        </div>

        <div class="setup-step">
          <label class="setup-label">4 · What are you aiming for?</label>
          <div class="setup-row">
            <input type="number" id="planGoal" class="setup-input" min="400" max="1600" step="10" value="${esc(plan.goal || 1500)}" />
            <span class="setup-hint" style="margin:0">total score, 400–1600</span>
          </div>
          <div class="setup-row" style="margin-top:10px">
            <span class="setup-hint" style="margin:0">Already have official scores? Optional.</span>
            <input type="number" id="planRw" class="setup-input sm" placeholder="R&W" min="200" max="800" value="${plan.baseline && plan.baseline.rw ? plan.baseline.rw : ''}" />
            <input type="number" id="planMath" class="setup-input sm" placeholder="Math" min="200" max="800" value="${plan.baseline && plan.baseline.math ? plan.baseline.math : ''}" />
          </div>
        </div>

        <div class="setup-actions">
          <button class="btn primary lg" data-plan-save>Build my plan ${ICONS.arrow}</button>
          ${state.settings.plan && state.settings.plan.createdAt ? '<button class="btn ghost lg" data-home>Cancel</button>' : ''}
        </div>
        <p class="setup-hint" style="margin-top:14px">Stored on this device. If you sign in, it follows you to other devices.</p>
      </div>
    </div>`);
  }

  /* ---------------- plan ---------------- */
  function planView(state) {
    const plan = state.settings.plan;
    const model = state.model;
    const schedule = state.schedule;
    const until = C().daysUntil(plan);
    const next = C().nextSession(schedule);
    const tips = C().buildTips(model, plan);

    // group sessions into weeks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOf = (d) => Math.floor((new Date(`${d}T00:00:00`) - today) / (7 * C().DAY));
    const weeks = new Map();
    for (const s of schedule.sessions) {
      const w = Math.max(0, weekOf(s.date));
      if (!weeks.has(w)) weeks.set(w, []);
      weeks.get(w).push(s);
    }

    const sessionRow = (s) => `<div class="sess">
      <div class="sess-date"><div class="sd-dow">${esc(s.dow)}</div><div class="sd-num">${esc(s.dateLabel.split(' ')[1] || '')}</div></div>
      <div class="sess-body">
        <div class="sess-top">
          <span class="pill ${KIND_CLASS[s.kind] || ''}" style="font-size:10.5px">${esc(KIND_LABEL[s.kind] || s.kind)}</span>
          <span class="sess-min">${s.minutes} min${s.count ? ` · ${s.count} q` : ''}</span>
        </div>
        <div class="sess-title">${esc(s.title)}</div>
        <div class="sess-detail">${esc(s.detail)}</div>
      </div>
      ${s.launch ? `<button class="btn sess-go" data-start="${esc(s.launch)}">Start</button>` : '<span class="sess-rest">—</span>'}
    </div>`;

    return el(`<div class="wrap">
      <div class="hero">
        <div>
          <h1>Your plan</h1>
          <p class="sub">Rebuilt after every attempt. It reads your misses by skill and error type, then puts the hardest work where it fits around your week.</p>
        </div>
        <div class="goal-chip">
          <div><div class="g-lab">Test in</div><div class="g-val">${until != null ? until : '—'}<span style="font-size:14px;font-weight:600"> days</span></div></div>
          <div class="vsep"></div>
          <div><div class="g-lab">Target</div><div class="g-val">${esc(plan.goal || 1500)}</div></div>
          <div class="vsep"></div>
          <div><div class="g-lab">In the plan</div><div class="g-val">${schedule.count}<span style="font-size:14px;font-weight:600"> sessions</span></div><div class="g-need">${Math.round(schedule.totalMinutes / 60)}h of work · ${schedule.daysPerWeek} days a week</div></div>
        </div>
      </div>

      ${next ? `<div class="card next-card">
        <div class="nc-left">
          <div class="pill accent" style="font-size:10.5px">Next session · ${esc(next.dow)} ${esc(next.dateLabel)}</div>
          <h3 style="margin:8px 0 6px">${esc(next.title)}</h3>
          <p class="nc-detail">${esc(next.detail)}</p>
          ${next.why ? `<p class="nc-why">${esc(next.why)}</p>` : ''}
        </div>
        <div class="nc-right">
          <div class="nc-min">~${next.minutes}<span>min block</span></div>
          ${next.launch ? `<button class="btn primary lg" data-start="${esc(next.launch)}">Start now ${ICONS.arrow}</button>` : ''}
        </div>
      </div>` : ''}

      <div class="section-h"><h2>What the coach sees</h2><span class="faint" style="font-size:12.5px">${model.attempts} attempt${model.attempts === 1 ? '' : 's'} · ${model.questionsSeen} questions</span></div>
      <div class="tips-grid">
        ${tips.map((t) => `<div class="tip-card">
          <div class="tip-kicker">${esc(t.kind === 'leak' ? 'biggest leak' : t.kind === 'pattern' ? 'error pattern' : t.kind === 'trend' ? 'trend' : t.kind === 'blind' ? 'blind spot' : 'start here')}</div>
          <h4>${esc(t.title)}</h4>
          <p>${esc(t.body)}</p>
          ${t.fix ? `<p class="tip-when"><strong>Do this:</strong> ${esc(t.fix)}</p>` : ''}
          ${t.action ? `<div class="tip-cta"><button class="btn primary" style="height:32px;font-size:12.5px;padding:0 14px" data-start="${esc(t.action)}">${esc(t.actionLabel || 'Start')} ${ICONS.arrow}</button></div>` : ''}
        </div>`).join('')}
      </div>

      <div class="card panel" style="margin-top:16px">
        <h3>Skill ledger</h3>
        <p class="p-sub">Recency-weighted accuracy across every attempt — a recent miss counts more than an old one. Lower bar and more questions = more urgent.</p>
        ${model.skills.length ? `<div class="bars">
          ${model.skills.slice(0, 8).map((s) => `<div class="bar-row">
            <div class="bl">
              <span class="bl-name">${esc(s.key)}<span class="ev ${esc(s.evidence)}">${esc(s.evidence)} data</span></span>
              <small>${esc(C().shortDomain(s.domain))} · ${s.n} question${s.n === 1 ? '' : 's'} over ${s.seen} attempt${s.seen === 1 ? '' : 's'}</small>
            </div>
            <div class="bar-track"><div class="bar-fill ${s.recency >= 0.8 ? 'good' : s.recency >= 0.6 ? '' : s.recency >= 0.4 ? 'warn' : 'bad'}${Math.round(s.recency * 100) === 0 ? ' zero' : ''}" style="width:${Math.round(s.recency * 100)}%"></div></div>
            <div class="bv ${s.recency >= 0.8 ? 'good' : s.recency >= 0.6 ? '' : s.recency >= 0.4 ? 'warn' : 'bad'}">${Math.round(s.recency * 100)}%<small>${s.misses} missed</small></div>
          </div>`).join('')}
        </div>` : `<div class="empty compact">No attempts yet — the ledger fills in after your first test.</div>`}
      </div>

      <div class="section-h"><h2>Schedule</h2><a href="#/setup" style="font-size:13px">Adjust survey</a></div>
      ${[...weeks.entries()].map(([w, list]) => `<div class="card panel" style="margin-bottom:14px">
        <h3 style="margin-bottom:12px">${w === 0 ? 'This week' : `Week ${w + 1}`}</h3>
        ${list.map(sessionRow).join('')}
      </div>`).join('')}

      <p class="faint" style="font-size:12px;margin-top:16px;text-align:center">
        ${schedule.count} sessions · ${schedule.daysPerWeek} days a week · ${Math.round(schedule.totalMinutes / 60)} hours total ·
        generated from ${model.attempts} attempt${model.attempts === 1 ? '' : 's'} on this device
      </p>
    </div>`);
  }

  global.CoachView = { survey, planView, KIND_LABEL, KIND_CLASS };
})(window);
