/* ============ coach: learner model, schedule, tips ============
   Deterministic on purpose. Everything here is derived from the user's own
   attempt history, so a tip can always be traced to the questions behind it,
   it works offline, and it can't invent a diagnosis.
   ============================================================ */

(function (global) {
  'use strict';

  const DAY = 86_400_000;
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const PACE = { math: 95, rw: 71 };

  const TAG_TEXT = {
    sign: 'sign and negation slips',
    arithmetic: 'careless arithmetic',
    misread: 'misreading the question',
    quantity: 'answering the wrong quantity',
    concept: 'a missing concept or rule',
    setup: 'a wrong setup',
    algebra: 'algebra manipulation',
    unit: 'units and conversions',
    gridin: 'grid-in entry errors',
    blank: 'running out of time',
  };

  const TAG_FIX = {
    sign: 'Before you commit, re-read your last line and check every sign you moved across.',
    arithmetic: 'Do the final two steps on paper, not in your head, and re-add before choosing.',
    misread: 'Underline the exact quantity asked for before you compute anything.',
    quantity: 'When you finish, ask "is this what the question asked for?" — not "is this true?"',
    concept: 'Write the rule on a card, then do five questions that need only that rule.',
    setup: 'Write the first line of the setup before touching the numbers.',
    algebra: 'Do three slow manipulation drills; check each step by substitution.',
    unit: 'Write the conversion factor as a fraction and cancel units before multiplying.',
    gridin: 'Enter the answer in Desmos first, read the value, then key it in.',
    blank: 'Two-pass every module: answer what you can in under half the pace, flag the rest.',
  };

  // Ordered most-specific first: every pattern is matched in turn, so a generic
  // one placed too early swallows skills that belong to a narrower topic.
  // Verified against all 2,242 bank items by tools/check-topics.mjs.
  const TOPICS = [
    // ---- reading & writing ----
    [/cross-text|connections/i, 'Cross-text connections'],
    [/boundar|comma|semicolon|colon|hyphen|dash|apostroph|possessive|punctuation|appositive|nonessential|essential element/i, 'Punctuation'],
    [/subject-verb|verb|tense|pronoun|modifier|agreement|parallel structure|parallelism|idiom|clause|fragment|run-on|form:/i, 'Grammar & usage'],
    [/transition|however|therefore|consequently|logical sequence|contrast|cause and effect|concession/i, 'Transitions'],
    [/synthesis|rhetorical|notes|conclusion|introduction|audience|\bgoal\b/i, 'Rhetoric & synthesis'],
    [/structure|function of (the )?(sentence|paragraph|text)/i, 'Text structure'],
    [/\bword(s)? (choice|in context)|vocabulary|precise|\bmeaning/i, 'Words in context'],

    // ---- math, narrow topics before broad ones ----
    [/nonlinear system|system|break-even|age and time/i, 'Systems of equations'],
    [/absolute value/i, 'Absolute value'],
    [/inequalit/i, 'Inequalities'],
    [/quadratic|parabola|axis of symmetry|vertex|completing the square|sum and product of roots|discriminant|projectile|revenue/i, 'Quadratics'],
    [/polynomial|factor theorem|remainder|factoring/i, 'Polynomials & factors'],
    [/rational (expression|equation)/i, 'Rational expressions'],
    [/radical|square root/i, 'Radical equations'],
    [/exponential|half-life|doubling|growth factor|decay|compound interest/i, 'Exponential models'],
    [/sine|cosine|tangent|trig|radian|cofunction|complementary/i, 'Right-triangle trig'],
    [/triangle|isosceles|exterior angle|pythagor|parallel line|similar/i, 'Triangles & angles'],
    [/circle|arc length|sector|inscribed/i, 'Circles'],
    [/volume|cylinder|cone|sphere|prism|pyramid|density|solid|composite area|\barea\b/i, 'Area & volume'],
    [/coordinate geometry|midpoint|perpendicular slope|parallel and perpendicular|distance between/i, 'Coordinate geometry'],
    [/function notation|composition|inverse function|transform|domain and range|piecewise|f\(x\)/i, 'Functions & transformations'],

    // ---- data & statistics (sampling must precede the reading catch-all) ----
    [/scatter|best fit|association|predicted value/i, 'Scatterplots & models'],
    [/sample|margin of error|population|survey|random(ized)?/i, 'Sampling & inference'],
    [/standard deviation|\bmean\b|\bmedian\b|\bmode\b|outlier|\brange\b|weighted average|average/i, 'Center & spread'],
    [/probability|two-way/i, 'Probability & tables'],

    // ---- broad math ----
    [/percent|original amount|ratio|proportion|unit conversion|unit rate|markup|discount|\brates?\b/i, 'Rates & percentages'],
    [/linear|slope|intercept|equation[s]? of (a )?line|rate of change|consecutive integers|constrained|interpreting parameters/i, 'Linear equations & slopes'],

    // ---- reading catch-all (last) ----
    [/command of evidence|central idea|inference|detail|evidence|graph|data/i, 'Reading comprehension'],
  ];

  function topicOf(skill, domain) {
    const s = String(skill || '');
    for (const [re, name] of TOPICS) if (re.test(s)) return name;
    return domain || 'Other';
  }

  const DOMAIN_SECTION = {
    Algebra: 'math',
    'Advanced Math': 'math',
    'Problem-Solving and Data Analysis': 'math',
    'Geometry and Trigonometry': 'math',
    'Information and Ideas': 'rw',
    'Craft and Structure': 'rw',
    'Expression of Ideas': 'rw',
    'Standard English Conventions': 'rw',
  };

  const shortDomain = (k) => {
    const map = {
      'Problem-Solving and Data Analysis': 'Data Analysis',
      'Geometry and Trigonometry': 'Geometry & Trig',
      'Information and Ideas': 'Information & Ideas',
      'Craft and Structure': 'Craft & Structure',
      'Expression of Ideas': 'Expression of Ideas',
      'Standard English Conventions': 'Conventions',
    };
    return map[k] || k;
  };

  /* ---------------- learner model ---------------- */
  function buildModel(history) {
    const now = Date.now();
    const attempts = (history || [])
      .filter((h) => h && typeof h.at === 'number')
      .sort((a, b) => b.at - a.at);

    const skillMap = new Map();
    const domainMap = new Map();
    const tags = {};
    let scored = 0;

    attempts.forEach((h) => {
      const ageDays = (now - h.at) / DAY;
      const w = Math.pow(0.5, ageDays / 14); // 14-day half-life
      scored++;

      // Fold the attempt's skills into topics first, then update each topic once.
      // Several skills can land in the same topic (two algebra skills in one set),
      // and updating per skill would count that attempt twice and double its weight.
      const perTopic = new Map();
      for (const s of h.skills || []) {
        const key = topicOf(s.k, s.d || s.domain);
        const agg =
          perTopic.get(key) ||
          { key, domain: s.d || s.domain, section: s.s || s.section, n: 0, c: 0, tags: {}, examples: new Set() };
        agg.n += s.n || 0;
        agg.c += s.c || 0;
        if (s.k) agg.examples.add(s.k);
        for (const [t, v] of Object.entries(s.t || {})) agg.tags[t] = (agg.tags[t] || 0) + v;
        perTopic.set(key, agg);
      }

      for (const agg of perTopic.values()) {
        if (!agg.n) continue;
        const acc = agg.c / agg.n;
        const cur =
          skillMap.get(agg.key) ||
          { key: agg.key, domain: agg.domain, section: agg.section, n: 0, c: 0, wsum: 0, wacc: 0, lastAt: 0, seen: 0, tags: {}, examples: new Set() };
        for (const ex of agg.examples) cur.examples.add(ex);
        cur.n += agg.n;
        cur.c += agg.c;
        cur.wsum += w;
        cur.wacc += acc * w;
        cur.seen += 1;
        cur.lastAt = Math.max(cur.lastAt, h.at);
        for (const [t, v] of Object.entries(agg.tags)) cur.tags[t] = (cur.tags[t] || 0) + v;
        skillMap.set(agg.key, cur);

        const dKey = agg.domain || 'Other';
        const d =
          domainMap.get(dKey) ||
          { key: dKey, section: agg.section, n: 0, c: 0, wsum: 0, wacc: 0, lastAt: 0 };
        d.n += agg.n;
        d.c += agg.c;
        d.wsum += w;
        d.wacc += acc * w;
        d.lastAt = Math.max(d.lastAt, h.at);
        domainMap.set(dKey, d);
      }

      for (const [t, v] of Object.entries(h.errors || {})) tags[t] = (tags[t] || 0) + v;
    });

    const skills = [...skillMap.values()]
      .map((s) => {
        const acc = s.n ? s.c / s.n : 0;
        const recency = s.wsum ? s.wacc / s.wsum : acc;
        const staleDays = (now - s.lastAt) / DAY;
        // weight recent failure hardest, then lifetime failure, then staleness
        const risk = 0.55 * (1 - recency) + 0.35 * (1 - acc) + 0.1 * Math.min(1, staleDays / 45);
        const topTag = Object.entries(s.tags).sort((a, b) => b[1] - a[1])[0];
        // one bad question is weak evidence: shrink the risk toward the mean until
        // there are enough questions to trust it
        const conf = 1 - Math.exp(-s.n / 3);
        return {
          ...s,
          examples: [...(s.examples || [])].slice(0, 3),
          acc,
          recency,
          staleDays,
          conf,
          rawRisk: risk,
          risk: risk * (0.45 + 0.55 * conf),
          misses: s.n - s.c,
          evidence: s.n >= 6 ? 'firm' : s.n >= 2 ? 'some' : 'thin',
          topTag: topTag ? topTag[0] : null,
        };
      })
      .filter((s) => s.n > 0)
      .sort((a, b) => b.risk - a.risk);

    const domains = [...domainMap.values()]
      .map((d) => ({
        ...d,
        acc: d.n ? d.c / d.n : 0,
        recency: d.wsum ? d.wacc / d.wsum : 0,
        misses: d.n - d.c,
      }))
      .sort((a, b) => b.recency - a.recency);

    const totalN = domains.reduce((s, d) => s + d.n, 0);
    const totalC = domains.reduce((s, d) => s + d.c, 0);
    const errorProfile = Object.entries(tags)
      .map(([tag, n]) => ({ tag, n, label: TAG_TEXT[tag] || tag, fix: TAG_FIX[tag] || '' }))
      .sort((a, b) => b.n - a.n);
    const careless = errorProfile
      .filter((e) => ['sign', 'arithmetic', 'misread', 'quantity', 'gridin'].includes(e.tag))
      .reduce((s, e) => s + e.n, 0);

    // trend: most recent third vs the rest
    const recent = attempts.slice(0, Math.max(1, Math.ceil(attempts.length / 3)));
    const older = attempts.slice(recent.length);
    const avgAcc = (list) => {
      const p = list.filter((h) => h.rw || h.math);
      if (!p.length) return null;
      let n = 0;
      let c = 0;
      for (const h of p) {
        n += (h.rw ? h.rw.total : 0) + (h.math ? h.math.total : 0);
        c += (h.rw ? h.rw.correct : 0) + (h.math ? h.math.correct : 0);
      }
      return n ? c / n : null;
    };
    const recentAcc = avgAcc(recent);
    const olderAcc = older.length ? avgAcc(older) : null;
    const delta = recentAcc != null && olderAcc != null ? recentAcc - olderAcc : null;

    return {
      attempts: scored,
      skills,
      domains,
      errorProfile,
      careless,
      accuracy: totalN ? totalC / totalN : 0,
      questionsSeen: totalN,
      recentAcc,
      olderAcc,
      delta,
      weakestSkills: skills.slice(0, 8),
      strongestSkills: skills.slice().sort((a, b) => a.risk - b.risk).filter((s) => s.acc >= 0.8).slice(0, 4),
    };
  }

  /* ---------------- plan defaults ---------------- */
  function defaultPlan() {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return {
      testDate: d.toISOString().slice(0, 10),
      days: [1, 2, 3, 4, 5],
      minutes: 45,
      goal: 1500,
      baseline: { rw: null, math: null },
      createdAt: null,
    };
  }

  const isComplete = (plan) => Boolean(plan && plan.createdAt && plan.testDate);

  function daysUntil(plan) {
    if (!plan || !plan.testDate) return null;
    const t = new Date(`${plan.testDate}T00:00:00`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((t - today.getTime()) / DAY);
  }

  /* ---------------- schedule ---------------- */
  function buildSchedule(model, plan, opts) {
    const o = opts || {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const testDate = new Date(`${plan.testDate}T00:00:00`);
    const minutes = Math.max(15, Number(plan.minutes) || 45);
    const days = Array.isArray(plan.days) && plan.days.length ? plan.days : [1, 2, 3, 4, 5];

    const slots = [];
    for (let d = new Date(today.getTime() + DAY); d < testDate && slots.length < 60; d = new Date(d.getTime() + DAY)) {
      if (days.includes(d.getDay())) slots.push(new Date(d));
    }
    // if the test is too close for the chosen weekdays, fall back to every day
    if (!slots.length) {
      for (let d = new Date(today.getTime() + DAY); d < testDate && slots.length < 20; d = new Date(d.getTime() + DAY)) {
        slots.push(new Date(d));
      }
    }

    const sessions = [];
    const ranked = (model.weakestSkills || []).slice();
    // a topic you are already clearing is not repair work; keep it out of the cycle
    // unless there is nothing shaky left to fill the sessions with
    let weak = ranked.filter((s) => s.recency < 0.85);
    if (!weak.length && ranked.length) weak = ranked.slice(0, 2);
    const domains = (model.domains || []).slice().sort((a, b) => a.recency - b.recency);
    const seenSecs = [...new Set(domains.map((d) => d.section).filter(Boolean))];
    const secs = seenSecs.length ? seenSecs : ['math', 'rw'];
    const both = secs.length > 1;
    const paceFor = (sec) => PACE[sec] || 85;

    // with no history yet, walk the domains in a fixed order so the first week
    // still covers the whole test instead of drilling one topic four times
    const COLD = [
      { key: 'Algebra', domain: 'Algebra', section: 'math', recency: 0, misses: 0, cold: true },
      { key: 'Advanced Math', domain: 'Advanced Math', section: 'math', recency: 0, misses: 0, cold: true },
      { key: 'Problem-Solving and Data Analysis', domain: 'Problem-Solving and Data Analysis', section: 'math', recency: 0, misses: 0, cold: true },
      { key: 'Geometry and Trigonometry', domain: 'Geometry and Trigonometry', section: 'math', recency: 0, misses: 0, cold: true },
    ];
    // one primary topic per session (deeper work), paired with a second one
    // every other session so nothing goes stale
    const pickTargets = (i) => {
      if (!weak.length) return [COLD[i % COLD.length]];
      const primary = weak[i % weak.length];
      if (weak.length > 1 && i % 2 === 0) {
        return [primary, weak[(i + 1) % weak.length]];
      }
      return [primary];
    };

    const launchFor = (t) => {
      if (!t) return 'ladder:math';
      const sec = t.section || 'math';
      return `drill:${sec}:${encodeURIComponent(t.domain || t.key)}:${encodeURIComponent(t.key)}`;
    };

    const total = slots.length;
    let lastSection = null;

    slots.forEach((date, i) => {
      const frac = total > 1 ? i / (total - 1) : 0;
      const left = total - i;
      const dow = WD[date.getDay()];
      const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isLast = left === 1;
      const isSecondLast = left === 2;

      // ---- taper ----
      if (isLast || (isSecondLast && total > 4)) {
        sessions.push({
          date: date.toISOString().slice(0, 10),
          dow,
          dateLabel,
          kind: isLast ? 'taper' : 'light',
          minutes: isLast ? 20 : Math.min(30, minutes),
          title: isLast ? 'Close the laptop' : 'Light review only',
          detail: isLast
            ? 'Five easy questions to warm up, read the reference sheet once, then stop. Sleep is worth more than one more set.'
            : `Re-read your error log end to end. ${model.errorProfile[0] ? `Watch for ${model.errorProfile[0].label} — that's your most common miss.` : ''} Nothing new today.`,
          targets: [],
          count: isLast ? 5 : 0,
          launch: isLast ? (lastSection ? `quick:${lastSection}` : 'quick:math') : null,
          why: 'taper',
        });
        return;
      }

      // ---- full-length rehearsal ----
      const longSlot = minutes >= 120;
      const rehearsalAt = total >= 8 ? (i === Math.round(total * 0.62) || i === Math.round(total * 0.88)) : i === Math.round(total * 0.7);
      if (rehearsalAt && left > 2) {
        if (longSlot) {
          sessions.push({
            date: date.toISOString().slice(0, 10),
            dow,
            dateLabel,
            kind: 'full',
            minutes: 134,
            title: 'Full-length test — 98 questions',
            detail: 'Both sections, all four modules, real adaptive routing, one break. Treat it like the real thing: no pausing, no phone.',
            targets: [],
            count: 98,
            launch: 'full',
            why: 'Full rehearsal is the only way to rehearse stamina and section switching.',
          });
          return;
        }
        const sec = secs[i % secs.length] || 'math';
        const modMin = sec === 'rw' ? 32 : 35;
        sessions.push({
          date: date.toISOString().slice(0, 10),
          dow,
          dateLabel,
          kind: 'rehearse',
          minutes: modMin,
          title: `${sec === 'rw' ? 'Reading & Writing' : 'Math'} module under real timing`,
          detail: `One module, full clock: ${sec === 'rw' ? '27 questions in 32 minutes' : '22 questions in 35 minutes'}. Stop when the clock stops, even mid-question.`,
          targets: [],
          count: sec === 'rw' ? 27 : 22,
          launch: sec === 'rw' ? 'rw' : 'math',
          why: 'You can only fix pacing under the real clock.',
        });
        return;
      }

      // ---- repair phase: weakest skills, untimed ----
      if (frac < 0.5) {
        const tg = pickTargets(i);
        const sec = tg[0] ? tg[0].section : domains[0] ? domains[0].section : 'math';
        const count = Math.max(6, Math.min(25, Math.round(minutes / 2.2)));
        lastSection = sec;
        sessions.push({
          date: date.toISOString().slice(0, 10),
          dow,
          dateLabel,
          kind: 'repair',
          minutes,
          title: tg.length ? `Repair: ${tg.map((t) => shortDomain(t.key)).join(' · ')}` : 'Repair: mixed math',
          detail: tg.length
            ? `Untimed — the clock is off. ${tg.map((t) => `${t.key} is at ${Math.round(t.recency * 100)}% (${t.misses} missed)`).join('; ')}. Write the rule before each answer, check it straight after, and stop after ${count} questions.`
            : 'Untimed mixed set in your weakest domain. Write down the first step before computing.',
          targets: tg.map((t) => ({ key: t.key, domain: t.domain, section: t.section })),
          count,
          launch: tg.length ? launchFor(tg[0]) : 'ladder:math',
          why: 'Early sessions are for understanding, so the clock is off.',
        });
        return;
      }

      // ---- sharpen phase: mixed, at pace, with spaced review ----
      if (frac < 0.78) {
        const sec = secs[i % secs.length];
        lastSection = sec;
        const paceSec = paceFor(sec);
        const count = Math.max(5, Math.min(27, Math.round((minutes * 60) / paceSec)));
        const revisit = weak[(i * 3) % Math.max(1, weak.length)];
        sessions.push({
          date: date.toISOString().slice(0, 10),
          dow,
          dateLabel,
          kind: 'sharpen',
          minutes,
          title: `Timed set: ${count} questions at ${paceSec}s`,
          detail: `On the clock. ${count} questions in ${Math.round((count * paceSec) / 60)} minutes — that is the real per-question budget.${revisit ? ` One of them will be ${revisit.key}, which you missed earlier; that is deliberate.` : ''}`,
          targets: revisit ? [{ key: revisit.key, domain: revisit.domain, section: revisit.section }] : [],
          count,
          launch: sec === 'rw' ? 'quick:rw' : 'quick:math',
          why: 'Accuracy is established; now it has to survive the clock.',
        });
        return;
      }

      // ---- rehearse / mixed ----
      const sec = secs[i % secs.length] || 'math';
      sessions.push({
        date: date.toISOString().slice(0, 10),
        dow,
        dateLabel,
        kind: 'sharpen',
        minutes,
        title: 'Mixed timed set — hardest tier',
        detail: `Push the ceiling: mostly hard and very hard, ${Math.round(minutes * 0.9)} minutes of work. Flag anything you guess and review those first.`,
        targets: [],
        count: Math.max(6, Math.min(20, Math.round(minutes / 2))),
        launch: sec === 'rw' ? 'ladder:rw' : 'ladder:math',
        why: 'The last stretch is about the questions that decide 750 vs 800.',
      });
    });

    return {
      sessions,
      count: sessions.length,
      minutesPerSession: minutes,
      daysPerWeek: days.length,
      totalMinutes: sessions.reduce((s, x) => s + x.minutes, 0),
    };
  }

  /* ---------------- tips ---------------- */
  function buildTips(model, plan) {
    const tips = [];
    const top = model.weakestSkills[0];
    const err = model.errorProfile[0];

    if (top) {
      tips.push({
        kind: 'leak',
        title: `${top.key} is your biggest leak`,
        body: `${top.evidence === 'thin' ? `Small sample (${top.n} question${top.n === 1 ? '' : 's'}) — a hunch for now. ` : ''}${Math.round(top.recency * 100)}% accuracy on ${top.n} question${top.n === 1 ? '' : 's'} across ${top.seen} attempt${top.seen === 1 ? '' : 's'}, ${top.misses} missed. ${
          top.topTag && TAG_FIX[top.topTag] ? `The misses are mostly ${TAG_TEXT[top.topTag]}.` : ''
        }`,
        fix: top.topTag && TAG_FIX[top.topTag] ? TAG_FIX[top.topTag] : 'Do ten of these untimed and write the rule each time.',
        action: `drill:${top.section}:${encodeURIComponent(top.domain)}:${encodeURIComponent(top.key)}`,
        actionLabel: `Drill ${top.key}`,
      });
    }

    if (err && err.n >= 2) {
      tips.push({
        kind: 'pattern',
        title: `${err.n} of your misses came from ${err.label}`,
        body:
          model.careless > 0
            ? `${model.careless} execution errors in total — points you already know how to earn, not content you're missing.`
            : 'This is a repeatable habit, which makes it the cheapest thing to fix.',
        fix: err.fix,
        action: null,
        actionLabel: null,
      });
    }

    if (model.delta != null && Math.abs(model.delta) >= 0.05) {
      tips.push({
        kind: 'trend',
        title: model.delta > 0 ? `Up ${Math.round(model.delta * 100)} points of accuracy lately` : `Down ${Math.round(-model.delta * 100)} points of accuracy lately`,
        body:
          model.delta > 0
            ? `Recent attempts are running at ${Math.round(model.recentAcc * 100)}% versus ${Math.round(model.olderAcc * 100)}% earlier. Whatever you changed in the last stretch, keep doing it.`
            : `Recent attempts are running at ${Math.round(model.recentAcc * 100)}% versus ${Math.round(model.olderAcc * 100)}% earlier. Check whether you are rushing — the clock, not the content, is the usual cause.`,
        fix: model.delta > 0 ? 'Protect the routine that got you here; don’t add new material this week.' : 'Drop your pace by 10 seconds a question for one session and watch what happens.',
        action: null,
        actionLabel: null,
      });
    }

    const tested = new Set(model.domains.map((d) => d.key));
    const sectionsSeen = new Set(model.domains.map((d) => d.section).filter(Boolean));
    const missing = ['Problem-Solving and Data Analysis', 'Geometry and Trigonometry', 'Standard English Conventions', 'Expression of Ideas', 'Information and Ideas', 'Craft and Structure']
      .filter((d) => !tested.has(d))
      .filter((d) => sectionsSeen.has(DOMAIN_SECTION[d]));
    if (missing.length && model.attempts > 0) {
      tips.push({
        kind: 'blind',
        title: `${shortDomain(missing[0])} is untested`,
        body: 'You have no data here yet, so the plan can only guess. One drill will tell us more than another attempt at what you already know.',
        fix: 'Run a ladder in that domain — twelve questions, easy to extreme.',
        action: 'ladder:math',
        actionLabel: 'Run a ladder',
      });
    }

    if (model.attempts === 0) {
      const longEnough = plan && Number(plan.minutes) >= 120;
      tips.unshift({
        kind: 'start',
        title: 'Take one test before you study',
        body: longEnough
          ? 'Right now the plan is a template. One full-length test turns it into a diagnosis with your name on it — and it rebuilds itself the moment you finish.'
          : 'Right now the plan is a template. A short diagnostic is enough to start: ten questions tell the coach which domain to attack first.',
        fix: longEnough
          ? 'Sit the full test cold. It is the only score that does not count against you.'
          : 'Start with a ten-question set, then open the plan again — the first week will re-cut itself around what you miss.',
        action: longEnough ? 'full' : 'quick:math',
        actionLabel: longEnough ? 'Start the full test' : 'Start a 10-question diagnostic',
      });
    }

    return tips.slice(0, 4);
  }

  /* ---------------- next session ---------------- */
  function nextSession(schedule) {
    if (!schedule || !schedule.sessions.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    return schedule.sessions.find((s) => s.date >= today) || schedule.sessions[0];
  }

  global.Coach = {
    DAY, WD, PACE, TAG_TEXT, TAG_FIX,
    buildModel, buildSchedule, buildTips, nextSession, topicOf,
    defaultPlan, isComplete, daysUntil, shortDomain,
  };
})(window);
