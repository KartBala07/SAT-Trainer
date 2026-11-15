/* ============ SAT Trainer — engine (two sections) ============ */
/* Module construction, adaptive routing, scoring, analysis, study plan.
   Pure functions: they take the bank and return data. */

(function (global) {
  'use strict';

  const DIFFS = [
    { key: 'easy', label: 'Easy', color: 'good' },
    { key: 'medium', label: 'Medium', color: 'accent' },
    { key: 'hard', label: 'Hard', color: 'warn' },
    { key: 'very_hard', label: 'Very Hard', color: 'violet' },
    { key: 'extreme', label: 'Extreme', color: 'bad' },
  ];
  const DIFF_ORDER = DIFFS.map((d) => d.key);
  const diffIndex = (d) => Math.max(0, DIFF_ORDER.indexOf(d));
  const diffLabel = (d) => (DIFFS.find((x) => x.key === d) || { label: String(d) }).label;

  /* ---------- section definitions ---------- */
  const SECTIONS = {
    rw: {
      key: 'rw',
      name: 'Reading & Writing',
      short: 'R&W',
      perModule: 27,
      moduleSec: 32 * 60,
      totalQ: 54,
      routeThreshold: 16,
      domains: [
        { key: 'Information and Ideas', short: 'Information & Ideas', weight: 7 },
        { key: 'Craft and Structure', short: 'Craft & Structure', weight: 8 },
        { key: 'Expression of Ideas', short: 'Expression of Ideas', weight: 5 },
        { key: 'Standard English Conventions', short: 'Conventions', weight: 7 },
      ],
      profiles: {
        m1: { easy: 0.15, medium: 0.4, hard: 0.3, very_hard: 0.1, extreme: 0.05 },
        m2easy: { easy: 0.42, medium: 0.4, hard: 0.16, very_hard: 0.02, extreme: 0 },
        m2hard: { easy: 0.02, medium: 0.2, hard: 0.42, very_hard: 0.26, extreme: 0.1 },
      },
      blurb: '32 minutes per module · 27 questions · one short passage per question',
    },
    math: {
      key: 'math',
      name: 'Math',
      short: 'Math',
      perModule: 22,
      moduleSec: 35 * 60,
      totalQ: 44,
      routeThreshold: 12,
      domains: [
        { key: 'Algebra', short: 'Algebra', weight: 8 },
        { key: 'Advanced Math', short: 'Advanced Math', weight: 7 },
        { key: 'Problem-Solving and Data Analysis', short: 'Data Analysis', weight: 4 },
        { key: 'Geometry and Trigonometry', short: 'Geometry & Trig', weight: 3 },
      ],
      profiles: {
        m1: { easy: 0.09, medium: 0.41, hard: 0.36, very_hard: 0.09, extreme: 0.05 },
        m2easy: { easy: 0.36, medium: 0.45, hard: 0.18, very_hard: 0.01, extreme: 0 },
        m2hard: { easy: 0.02, medium: 0.18, hard: 0.45, very_hard: 0.25, extreme: 0.1 },
      },
      blurb: '35 minutes per module · 22 questions · Desmos allowed throughout',
    },
  };
  // the real test runs Reading & Writing first
  const SECTION_KEYS = ['rw', 'math'];

  /* ---------- raw -> scaled ---------- */
  const RAW_SCALE = {
    math: {
      0: 200, 1: 220, 2: 245, 3: 265, 4: 285, 5: 305, 6: 325, 7: 340, 8: 355, 9: 370,
      10: 385, 11: 400, 12: 415, 13: 430, 14: 445, 15: 460, 16: 475, 17: 490, 18: 505,
      19: 515, 20: 525, 21: 535, 22: 545, 23: 555, 24: 565, 25: 575, 26: 585, 27: 595,
      28: 605, 29: 615, 30: 625, 31: 635, 32: 645, 33: 655, 34: 665, 35: 675, 36: 685,
      37: 695, 38: 705, 39: 715, 40: 730, 41: 745, 42: 760, 43: 780, 44: 800,
    },
    rw: {
      0: 200, 2: 230, 4: 260, 6: 290, 8: 320, 10: 350, 12: 375, 14: 400, 16: 420,
      18: 440, 20: 460, 22: 475, 24: 490, 26: 505, 28: 520, 30: 535, 32: 550, 34: 565,
      36: 580, 38: 600, 40: 620, 42: 645, 44: 670, 46: 692, 48: 712, 50: 735, 52: 765, 54: 800,
    },
  };

  function interp(table, x) {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (x <= keys[0]) return table[keys[0]];
    if (x >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
    for (let i = 0; i < keys.length - 1; i++) {
      if (x >= keys[i] && x <= keys[i + 1]) {
        const t = (x - keys[i]) / (keys[i + 1] - keys[i]);
        return Math.round(table[keys[i]] + t * (table[keys[i + 1]] - table[keys[i]]));
      }
    }
    return 500;
  }

  function rawToScaled(section, raw, path) {
    const conf = SECTIONS[section];
    const r = Math.max(0, Math.min(conf.totalQ, Math.round(raw)));
    let score = interp(RAW_SCALE[section], r);
    if (path === 'hard') score += 10;
    if (path === 'easy') score -= 10;
    return Math.max(200, Math.min(800, score));
  }

  const PERCENTILE = {
    800: 99, 780: 99, 760: 98, 745: 97, 730: 96, 715: 94, 705: 93, 695: 91, 685: 89,
    675: 88, 665: 86, 655: 84, 645: 82, 635: 80, 625: 78, 615: 76, 605: 73, 595: 71,
    585: 68, 575: 66, 565: 63, 555: 61, 545: 58, 535: 56, 525: 53, 515: 51, 505: 48,
    490: 45, 475: 42, 460: 39, 445: 36, 430: 33, 415: 30, 400: 27, 385: 24, 370: 22,
    355: 19, 340: 17, 325: 15, 305: 13, 285: 11, 265: 9, 245: 7, 220: 5, 200: 3,
  };

  function percentile(scaled) {
    if (scaled >= 800) return 99;
    if (scaled <= 200) return 3;
    const keys = Object.keys(PERCENTILE).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (scaled >= keys[i] && scaled <= keys[i + 1]) {
        const t = (scaled - keys[i]) / (keys[i + 1] - keys[i]);
        return Math.round(PERCENTILE[keys[i]] + t * (PERCENTILE[keys[i + 1]] - PERCENTILE[keys[i]]));
      }
    }
    return 50;
  }

  /* ---------- rng ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    const r = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shuffleChoices(q, rand) {
    if (q.type !== 'mcq' || !Array.isArray(q.choices) || q.choices.length !== 4) return q;
    const idx = shuffle([0, 1, 2, 3], rand);
    const correctIdx = 'ABCD'.indexOf(q.answer);
    return Object.assign({}, q, {
      choices: idx.map((i) => q.choices[i]),
      answer: 'ABCD'[idx.indexOf(correctIdx)],
      choice_notes: q.choice_notes ? idx.map((i) => q.choice_notes[i]) : null,
      error_tags: q.error_tags ? idx.map((i) => q.error_tags[i]) : null,
    });
  }

  /* ---------- numeric answer comparison ---------- */
  function normAnswer(s) {
    if (s == null) return '';
    return String(s)
      .trim()
      .replace(/\$/g, '')
      .replace(/\\left|\\right/g, '')
      .replace(/\\,/g, '')
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/\s+/g, '')
      .replace(/^\+/, '');
  }

  function evalSimple(s) {
    let t = s.replace(/\\(?:d)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    t = t.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
    t = t.replace(/[^0-9+\-*/().^sqrt]/g, '');
    if (!t || !/^[0-9+\-*/().^sqrt]+$/.test(t)) return NaN;
    try {
      const f = new Function(`"use strict";return (${t.replace(/\^/g, '**')});`);
      const v = f();
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  }

  function answersMatch(given, q) {
    const g = normAnswer(given);
    if (!g) return false;
    const pool = [q.answer].concat(q.accepted_spr || []).map(normAnswer);
    if (pool.some((p) => p === g)) return true;
    const gv = evalSimple(g);
    if (isNaN(gv)) return false;
    return pool.some((p) => {
      const pv = evalSimple(p);
      return !isNaN(pv) && Math.abs(pv - gv) <= Math.max(0.002, Math.abs(pv) * 1e-6);
    });
  }

  /* ---------- module construction ---------- */
  function quotasFor(n, profile) {
    const raw = DIFF_ORDER.map((t) => ({ t, exact: n * (profile[t] || 0) }));
    const counts = raw.map((r) => Math.floor(r.exact));
    let remainder = n - counts.reduce((a, b) => a + b, 0);
    const fracs = raw.map((r, i) => ({ i, f: r.exact - Math.floor(r.exact) })).sort((a, b) => b.f - a.f);
    for (let i = 0; remainder > 0 && i < fracs.length * 2; i++) {
      counts[fracs[i % fracs.length].i]++;
      remainder--;
    }
    const q = {};
    DIFF_ORDER.forEach((t, i) => (q[t] = counts[i]));
    return q;
  }

  function takeDomain(list, n, profile, used, rand) {
    if (n <= 0) return [];
    const quota = quotasFor(n, profile);
    const out = [];
    const pickTier = (tier, want) => {
      let taken = 0;
      const pool = shuffle(list.filter((q) => q.difficulty === tier && !used.has(q.id)), rand);
      for (const q of pool) {
        if (taken >= want) break;
        if (used.has(q.id)) continue;
        out.push(q);
        used.add(q.id);
        taken++;
      }
      return taken;
    };
    let missing = 0;
    for (const t of DIFF_ORDER) missing += (quota[t] || 0) - pickTier(t, quota[t] || 0);
    if (missing > 0) {
      for (const q of shuffle(list.filter((q) => !used.has(q.id)), rand)) {
        if (missing <= 0) break;
        out.push(q);
        used.add(q.id);
        missing--;
      }
    }
    return out;
  }

  function poolFor(bank, sectionKey) {
    if (Array.isArray(bank)) return bank.filter((q) => (q.section || 'math') === sectionKey);
    if (bank[sectionKey]) return bank[sectionKey];
    return (bank.items || []).filter((q) => (q.section || 'math') === sectionKey);
  }

  function buildModule(bank, sectionKey, profileKey, opts) {
    const conf = SECTIONS[sectionKey];
    const profile = conf.profiles[profileKey];
    const o = opts || {};
    const rand = o.rand || Math.random;
    const used = o.used || new Set();
    const pool = poolFor(bank, sectionKey);
    let picked = [];
    for (const d of conf.domains) {
      picked = picked.concat(takeDomain(pool.filter((q) => q.domain === d.key), d.weight, profile, used, rand));
    }
    if (picked.length < conf.perModule) {
      for (const q of shuffle(pool.filter((x) => !used.has(x.id)), rand)) {
        if (picked.length >= conf.perModule) break;
        picked.push(q);
        used.add(q.id);
      }
    }
    picked = picked.slice(0, conf.perModule);
    // Graceful degradation: if the section's pool is smaller than the excluded
    // set (tiny or freshly grown bank), fall back to any available items rather
    // than handing back an empty module.
    if (!picked.length) {
      picked = shuffle(pool, rand).slice(0, conf.perModule);
      picked.forEach((q) => used.add(q.id));
    }
    // If the pool was too small to avoid reuse, give the reused item a fresh id
    // so answers stay keyed per instance and grading can't cross modules.
    const seenIds = new Set(used);
    picked = picked.map((q) => {
      let id = q.id;
      if (seenIds.has(id)) {
        let k = 2;
        while (seenIds.has(`${q.id}~${k}`)) k++;
        id = `${q.id}~${k}`;
      }
      seenIds.add(id);
      return id === q.id ? q : Object.assign({}, q, { id });
    });
    picked.sort((a, b) => diffIndex(a.difficulty) - diffIndex(b.difficulty));
    const out = [];
    const a = picked.filter((_, i) => i % 2 === 0);
    const b = picked.filter((_, i) => i % 2 === 1);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out.map((q) => shuffleChoices(q, rand));
  }

  /* ---------- forms ---------- */
  function formSeed(formNo, sectionKey, mod) {
    const base = 2654435761;
    const salt = sectionKey === 'rw' ? 0x9e3779b9 : 0x85ebca6b;
    const s = (Math.imul(formNo + 1, base) ^ salt ^ Math.imul(mod + 1, 40503)) >>> 0;
    return s;
  }

  // Module 1 of a form is fixed by the seed; module 2 depends on the path earned,
  // so a given form always produces the same test for a given performance.
  function buildFormModule(formNo, bank, sectionKey, mod, path) {
    const rand = mulberry32(formSeed(formNo, sectionKey, mod));
    const used = new Set();
    if (mod === 1) {
      const m1 = buildModule(bank, sectionKey, 'm1', { rand: mulberry32(formSeed(formNo, sectionKey, 0)), used: new Set() });
      m1.forEach((q) => used.add(q.id));
    }
    const profileKey = mod === 0 ? 'm1' : path === 'hard' ? 'm2hard' : 'm2easy';
    return buildModule(bank, sectionKey, profileKey, { rand, used });
  }

  function buildDrill(bank, sectionKey, domain, n, rand) {
    const pool = poolFor(bank, sectionKey).filter((q) => q.domain === domain);
    const buckets = {};
    for (const q of pool) (buckets[q.difficulty] = buckets[q.difficulty] || []).push(q);
    for (const k of Object.keys(buckets)) buckets[k] = shuffle(buckets[k], rand);
    const out = [];
    let i = 0;
    while (out.length < Math.min(n, pool.length) && i < 500) {
      const d = DIFF_ORDER[i % DIFF_ORDER.length];
      const b = buckets[d];
      if (b && b.length) out.push(shuffleChoices(b.shift(), rand));
      i++;
    }
    return out;
  }

  function buildLadder(bank, sectionKey, n, rand) {
    const r = rand || Math.random;
    const plan = [['easy', 2], ['medium', 3], ['hard', 3], ['very_hard', 2], ['extreme', 2]];
    const out = [];
    for (const [d, count] of plan) {
      const pool = poolFor(bank, sectionKey).filter((q) => q.difficulty === d);
      shuffle(pool, r).slice(0, count).forEach((q) => out.push(shuffleChoices(q, r)));
    }
    return out.slice(0, n);
  }

  function buildQuick(bank, sectionKey, n, rand) {
    const r = rand || Math.random;
    const pool = poolFor(bank, sectionKey);
    const tiers = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
    const out = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const want = tiers[Math.min(tiers.length - 1, Math.floor((i / n) * tiers.length))];
      let cand = pool.filter((q) => q.difficulty === want && !used.has(q.id));
      if (!cand.length) cand = pool.filter((q) => !used.has(q.id));
      if (!cand.length) break;
      const q = cand[Math.floor(r() * cand.length)];
      used.add(q.id);
      out.push(shuffleChoices(q, r));
    }
    return out;
  }

  /* ---------- analysis ---------- */
  const TAG_LABEL = {
    misread: 'Misread the question',
    sign: 'Sign / negation slip',
    algebra: 'Algebra manipulation',
    concept: 'Concept or rule not known',
    setup: 'Wrong setup / wrong rule applied',
    unit: 'Units & conversion',
    quantity: 'Answered wrong quantity',
    arithmetic: 'Careless arithmetic',
    blank: 'Left blank / ran out of time',
    gridin: 'Grid-in value off',
    unclear: 'Unrecognised error pattern',
  };
  const CARELESS = new Set(['sign', 'arithmetic', 'misread', 'quantity']);

  function analyze(records, meta) {
    const total = records.length;
    const correct = records.filter((r) => r.correct).length;

    const group = (keyFn) => {
      const m = new Map();
      for (const r of records) {
        const k = keyFn(r);
        if (k == null) continue;
        if (!m.has(k)) m.set(k, { key: k, n: 0, correct: 0, sec: 0 });
        const g = m.get(k);
        g.n++;
        g.correct += r.correct ? 1 : 0;
        g.sec += r.ms / 1000;
      }
      return [...m.values()].map((g) => ({ ...g, acc: g.n ? g.correct / g.n : 0, avgSec: g.n ? g.sec / g.n : 0 }));
    };

    const domains = group((r) => r.domain);
    const diffs = DIFF_ORDER.map((d) => group((r) => r.difficulty).find((x) => x.key === d)).filter(Boolean);

    const tagCount = {};
    for (const r of records) {
      if (r.correct) continue;
      const tag = r.errorTag && r.errorTag !== 'none' ? r.errorTag : r.given == null || r.given === '' ? 'blank' : 'unclear';
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
    const fingerprint = Object.entries(tagCount)
      .map(([k, v]) => ({ tag: k, label: TAG_LABEL[k] || k, n: v }))
      .sort((a, b) => b.n - a.n);
    const carelessMisses = Object.entries(tagCount).filter(([k]) => CARELESS.has(k)).reduce((s, [, v]) => s + v, 0);
    const knowledgeMisses = Object.entries(tagCount)
      .filter(([k]) => ['concept', 'setup', 'algebra'].includes(k))
      .reduce((s, [, v]) => s + v, 0);

    const totalSec = records.reduce((s, r) => s + r.ms / 1000, 0);
    const avgSec = total ? totalSec / total : 0;
    const pace = meta && meta.paceSec ? meta.paceSec : 90;
    const rushed = records.filter((r) => !r.correct && r.ms / 1000 < pace * 0.5).length;
    const overthinking = records.filter((r) => r.correct && r.ms / 1000 > pace * 1.7).length;
    const blanks = records.filter((r) => r.given == null || r.given === '').length;

    // Per-tier accuracy, not cumulative: "solid through X" must mean you were
    // actually above 60% at X, not that your average across everything was.
    let ceiling = null;
    let dropoff = null;
    for (const d of diffs) {
      if (d.acc >= 0.6) ceiling = d.key;
      else if (!dropoff) dropoff = d.key;
    }

    const skillMap = new Map();
    for (const r of records) {
      if (!r.skill) continue;
      if (!skillMap.has(r.skill)) skillMap.set(r.skill, { skill: r.skill, domain: r.domain, n: 0, correct: 0, maxDiff: 'easy' });
      const s = skillMap.get(r.skill);
      s.n++;
      s.correct += r.correct ? 1 : 0;
      if (diffIndex(r.difficulty) > diffIndex(s.maxDiff)) s.maxDiff = r.difficulty;
    }
    const skillGaps = [...skillMap.values()]
      .filter((s) => s.correct < s.n)
      .map((s) => ({ ...s, missed: s.n - s.correct, acc: s.correct / s.n }))
      .sort((a, b) => b.missed - a.missed || diffIndex(b.maxDiff) - diffIndex(a.maxDiff));

    return {
      total, correct, acc: total ? correct / total : 0, blanks,
      domains, diffs, fingerprint, carelessMisses, knowledgeMisses,
      totalSec, avgSec, pace, rushed, overthinking, ceiling, dropoff, skillGaps,
    };
  }

  /* ---------- 14-day plan ---------- */
  function buildPlan(analysis, sectionKey, scaled) {
    const conf = SECTIONS[sectionKey];
    const weak = analysis.domains.slice().sort((a, b) => a.acc - b.acc);
    const short = (k) => (conf.domains.find((d) => d.key === k) || { short: k }).short;
    const f1 = weak[0] || { key: conf.domains[0].key, acc: 0 };
    const f2 = weak[1] || f1;
    const f3 = weak[2] || f2;
    const skills = (domain) => analysis.skillGaps.filter((s) => s.domain === domain).slice(0, 3).map((s) => s.skill);
    const listSkills = (arr) => (arr.length ? arr.join(', ') : 'a mixed set across all difficulties');
    const missed = analysis.total - analysis.correct;
    const careless = analysis.fingerprint.filter((f) => CARELESS.has(f.tag)).map((f) => f.label.toLowerCase()).slice(0, 3);
    const pace = Math.round(conf.moduleSec / conf.perModule);
    const isMath = sectionKey === 'math';

    const days = [];
    const push = (d, title, detail, tags) => days.push({ d, title, detail, tags });

    push('Day 1', 'Build the error log — the highest-value hour of the two weeks',
      `Take every missed question and write one line: what the question actually asked, where your work diverged, and the one rule you'll apply next time. ${analysis.carelessMisses} of your ${missed} misses were execution errors${careless.length ? ` (${careless.join(', ')})` : ''} — those are points you already own.`,
      ['Review', `${missed} misses`]);
    push('Day 2', `Repair ${short(f1.key)} — weakest at ${Math.round(f1.acc * 100)}%`,
      `Work ${listSkills(skills(f1.key))} slowly and untimed. 15 questions at medium then hard, checking each answer immediately. Target: ${Math.round(f1.acc * 100)}% → 80%.`,
      [short(f1.key), 'Untimed']);
    push('Day 3', `${short(f1.key)} at real pace — ${pace}s a question`,
      isMath
        ? `Same skills on the clock: 12 questions, ${Math.round((12 * pace) / 60)} minutes. If you cannot finish in ${pace}s, graph it in Desmos instead of grinding the algebra.`
        : `Same skills on the clock: 12 questions in ${Math.round((12 * pace) / 60)} minutes. Read the question stem before the passage — you only need the sentence the question points at.`,
      [short(f1.key), 'Timed']);
    push('Day 4', `Repair ${short(f2.key)} — ${Math.round(f2.acc * 100)}% accuracy`,
      `Drill ${listSkills(skills(f2.key))}. Write the rule or the first step down before you answer; most misses at this level are the wrong rule applied confidently.`,
      [short(f2.key), 'Untimed']);
    push('Day 5', `${short(f3.key)} + ${isMath ? 'Desmos speed work' : 'evidence discipline'}`,
      `15 questions in ${short(f3.key)} (${listSkills(skills(f3.key))}). ${isMath ? 'For each one ask: which is faster, the algebra or the graph? Practise typing a system into Desmos in under twenty seconds.' : 'For every answer, underline the exact words in the passage that justify it before you choose. No underline, no answer.'}`,
      [short(f3.key), isMath ? 'Desmos' : 'Evidence']);
    push('Day 6', 'Hard-only set — chase your ceiling',
      `Your ceiling today was ${analysis.ceiling ? diffLabel(analysis.ceiling) : 'below the easy tier'}. Twelve hard and very hard questions with no time limit. The point is pattern recognition, not score.`,
      ['Hard', 'Very Hard']);
    push('Day 7', `Full ${conf.name} retest — both modules, real timing`,
      'Simulate conditions: no phone, no pausing, one short break between modules. Compare domain accuracy against today rather than the raw score.',
      ['Full Section', 'Adaptive']);
    push('Day 8', 'Retest autopsy + spaced review',
      'Re-run the misses from day 7. Any skill missed twice goes on a flashcard with the exact rule. Re-do three questions from day 2 — if they are clean now, that skill is closed.',
      ['Review', 'Spaced']);
    push('Day 9', 'Extreme tier — the questions that decide 750 vs 800',
      'Eight extreme questions, then re-derive each solution from scratch without looking. Slow is fine; wrong is not.',
      ['Extreme', 'Untimed']);
    push('Day 10', isMath ? 'Calculator-free fluency sprint' : 'Decision-speed sprint',
      isMath
        ? 'Two 15-minute sprints of medium algebra and geometry with Desmos closed. Most lost time is spent typing what you could do in your head.'
        : `Four sets of 10 questions in ${Math.round((10 * pace) / 60)} minutes each. The R&W clock punishes rereading, not slow reading — practise deciding.`,
      [isMath ? 'Speed' : 'Timing', isMath ? 'No calculator' : 'Pace']);
    push('Day 11', 'Mixed timed set — one clean module',
      `${conf.perModule} questions in ${Math.round(conf.moduleSec / 60)} minutes. Target finishing with three or four minutes spare; that buffer is what saves you from the one question that eats ninety seconds.`,
      ['Timed', 'Module']);
    push('Day 12', 'Full retest #2',
      `Target: ${scaled} → ${Math.min(800, scaled + 40)}. If you are already at 750+, the last two days are about consistency, not new content.`,
      ['Full Test']);
    push('Day 13', 'Weak-skill sweep + error log close-out',
      'Only the skills that are still shaky. Ten questions, untimed, then read the whole error log end to end. No new material today.',
      ['Review']);
    push('Day 14', 'Taper — light review, then stop',
      'Read the reference sheet once, do five easy questions to warm up, then close the laptop. Sleep beats one more problem set.',
      ['Taper', 'Rest']);

    return { days, focus: weak.slice(0, 3) };
  }

  global.SAT = {
    DIFFS, DIFF_ORDER, SECTIONS, SECTION_KEYS, RAW_SCALE,
    diffIndex, diffLabel, rawToScaled, percentile, interp,
    mulberry32, shuffle, shuffleChoices, answersMatch, normAnswer,
    buildModule, buildFormModule, formSeed, buildDrill, buildLadder, buildQuick,
    poolFor, analyze, buildPlan, TAG_LABEL,
  };
})(window);
