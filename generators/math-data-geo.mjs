// generators/math-data-geo.mjs
//
// Parametric, deterministic generators for the Digital SAT Math domains
//   * Problem-Solving and Data Analysis
//   * Geometry and Trigonometry
//
// Rules enforced here:
//   * mulberry32 only — never Math.random().
//   * every answer is COMPUTED from drawn parameters and re-verified in a
//     second, independent way before the item is emitted (the `check` field
//     records exactly what was recomputed).
//   * every MCQ has exactly four distinct choices, exactly one of which is
//     numerically equal to the computed answer.
//
//   node generators/math-data-geo.mjs   -> generated/math-data-geo.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEED = 20261115;

export const DATA_DOMAIN = 'Problem-Solving and Data Analysis';
export const GEO_DOMAIN = 'Geometry and Trigonometry';

/* ================================================================== *
 * 1. Seeded RNG
 * ================================================================== */

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    this.next = mulberry32(seed >>> 0);
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  chance(p) {
    return this.next() < p;
  }
  /** draw until predicate holds, at most n times */
  retry(n, fn) {
    for (let i = 0; i < n; i++) {
      const v = fn();
      if (v != null) return v;
    }
    return null;
  }
}

/* ================================================================== *
 * 2. Number / LaTeX formatting
 * ================================================================== */

function num(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('non-finite value: ' + x);
  const r = Math.round(x * 1e6) / 1e6;
  if (Object.is(r, -0)) return '0';
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** reduced LaTeX fraction, integer if denominator divides numerator */
function frac(n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('frac needs ints');
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return (n < 0 ? '-' : '') + '\\frac{' + Math.abs(n) + '}{' + d + '}';
}

/** reduced plain fraction for grid-ins: "5/3" */
function fracPlain(n, d) {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : n + '/' + d;
}

/** simplified radical: sqrt(n) = a*sqrt(b) */
function sqrtTex(n) {
  let out = 1;
  let inner = n;
  for (let i = 2; i * i <= inner; i++) {
    while (inner % (i * i) === 0) {
      inner /= i * i;
      out *= i;
    }
  }
  if (inner === 1) return String(out);
  return (out === 1 ? '' : String(out)) + '\\sqrt{' + inner + '}';
}

/** k*pi where k = n/d  ->  "3\pi", "\frac{3\pi}{4}", "-2\pi" */
function piFrac(n, d) {
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (d === 1) return sign + (a === 1 ? '' : String(a)) + '\\pi';
  return sign + '\\frac{' + (a === 1 ? '' : String(a)) + '\\pi}{' + d + '}';
}

const comma = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

function moneyTex(x) {
  const r = Math.round(x * 100) / 100;
  const s = Number.isInteger(r) ? comma(String(r)) : comma(r.toFixed(2));
  return '$\\$' + s + '$';
}

function pctTex(p) {
  return '$' + num(p) + '\\%$';
}

/** pipe table from header + rows, real newlines */
function pipeTable(head, rows) {
  const sep = head.map(() => '---');
  return ['| ' + head.join(' | ') + ' |', '| ' + sep.join(' | ') + ' |', ...rows.map((r) => '| ' + r.join(' | ') + ' |')].join('\n');
}

/* ================================================================== *
 * 3. LaTeX -> number (independent re-read of the emitted answer text)
 * ================================================================== */

function stripTex(s) {
  let t = String(s);
  t = t.replace(/\\\$/g, ''); // escaped dollar (money) first
  t = t.replace(/\$/g, '');
  t = t.replace(/\\left|\\right/g, '');
  t = t.replace(/\\[,;:!]/g, '');
  t = t.replace(/\{,\}/g, '');
  t = t.replace(/\\%/g, '%');
  t = t.replace(/\\ /g, ' ');
  t = t.replace(/\^\\circ/g, '');
  t = t.replace(/\s+/g, '');
  return t;
}

/**
 * Parses the small LaTeX subset these generators emit:
 *   numbers, \frac{a}{b}, \sqrt{n}, a\sqrt{n}, \pi, products and +/- sums,
 *   trailing % (kept as the percent number itself).
 * Returns a number, or NaN when it cannot read the string.
 */
export function parseVal(src) {
  const t = stripTex(src);
  if (!t) return NaN;
  // plain grid-in fraction such as "187/5" or "3/2"
  const slash = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t);
  if (slash) return Number(slash[1]) / Number(slash[2]);
  let i = 0;

  function atom() {
    if (t[i] === '-') {
      i++;
      return -atom();
    }
    if (t[i] === '+') {
      i++;
      return atom();
    }
    if (t.startsWith('\\frac', i)) {
      i += 5;
      const a = group();
      const b = group();
      return a / b;
    }
    if (t.startsWith('\\sqrt', i)) {
      i += 5;
      return Math.sqrt(group());
    }
    if (t.startsWith('\\pi', i)) {
      i += 3;
      return Math.PI;
    }
    let start = i;
    while (i < t.length && /[0-9.]/.test(t[i])) i++;
    if (i === start) {
      i++;
      return NaN;
    }
    return parseFloat(t.slice(start, i));
  }

  function group() {
    if (t[i] !== '{') return atom();
    i++; // {
    const v = expr();
    if (t[i] === '}') i++;
    return v;
  }

  // a run of factors multiplied implicitly: 3\pi, 2\sqrt{5}, \frac{1}{2}\sqrt{3}
  function term() {
    let v = atom();
    for (;;) {
      if (i >= t.length || t[i] === '}' || t[i] === '+' || t[i] === '-') break;
      if (t[i] === '%') break;
      if (t[i] === '\\' || t[i] === '{' || /[0-9]/.test(t[i])) {
        const save = i;
        const f = atom();
        if (Number.isNaN(f) || i <= save) {
          i = save;
          break;
        }
        v *= f;
        continue;
      }
      break;
    }
    return v;
  }

  function expr() {
    let v = term();
    for (;;) {
      if (i >= t.length || t[i] === '}') break;
      const ch = t[i];
      if (ch === '+') {
        i++;
        v += term();
        continue;
      }
      if (ch === '-') {
        i++;
        v -= term();
        continue;
      }
      if (ch === '%') {
        i++;
        continue;
      }
      break;
    }
    return v;
  }

  const v = expr();
  if (i < t.length - 0 && i !== t.length) {
    // leftover characters (e.g. "(3,-2)") -> unreadable
    if (!/^[%\s]*$/.test(t.slice(i))) return NaN;
  }
  return v;
}

/* ================================================================== *
 * 4. Item assembly (choices, keying, grid-in forms)
 * ================================================================== */

const LETTER = 'ABCD';
const EPS = 1e-7;

function keyOf(v, text) {
  if (typeof v === 'number' && Number.isFinite(v)) return 'n:' + Math.round(v * 1e6) / 1e6;
  if (text != null) {
    const p = parseVal(text);
    if (!Number.isNaN(p)) return 'n:' + Math.round(p * 1e6) / 1e6;
    return 't:' + String(text).replace(/\s+/g, '');
  }
  return 't:' + String(v);
}

/** render a numeric distractor in the same style as the correct answer */
function formatLike(correctText, v) {
  const ct = String(correctText == null ? '' : correctText);
  if (ct.startsWith('$\\$')) return moneyTex(v);
  if (/^-?\\frac\{\d+\}\{\d+\}$/.test(ct)) {
    if (Number.isInteger(v)) return String(v);
    for (let d = 2; d <= 100; d++) {
      const n = Math.round(v * d);
      if (Math.abs(n / d - v) < 1e-9) return frac(n, d);
    }
    return num(v);
  }
  if (/^-?\d+(\.\d+)?$/.test(ct) && Number.isInteger(v)) return String(v);
  const s = num(v);
  // keep plausible-looking distractors short: no long repeating decimals
  if (s.includes('.') && s.split('.')[1].length > 3) return String(Math.round(v * 100) / 100);
  return s;
}

function plainNumber(text) {
  const s = String(text);
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  const m = /^-?\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return fracPlain(Number(m[1]) * (s.startsWith('-') ? -1 : 1), Number(m[2]));
  return null;
}

/** the app only typesets $...$ spans, so wrap any bare LaTeX choice text */
function choiceTex(t) {
  if (t == null) return t;
  const s = String(t);
  if (s.startsWith('$')) return s;
  if (/\\[a-zA-Z]/.test(s) || /\^/.test(s)) return '$' + s + '$';
  return s;
}

/**
 * Assemble one item. `body` must carry num (number), text (LaTeX answer),
 * alts (3 tuples [value, note, tag]) and optionally spr (grid-in text).
 */
function assemble(r, g, L, body, wantSpr) {
  const stem = body.stem;
  const base = {
    section: 'math',
    domain: g.domain,
    skill: g.skill,
    difficulty: ['easy', 'medium', 'hard', 'very_hard', 'extreme'][L],
    stem,
    explanation: body.expl,
    desmos: body.desmos || '',
    skill_note: body.note,
    check: body.check,
  };

  if (wantSpr) {
    const spr = body.spr != null ? String(body.spr) : plainNumber(body.text);
    if (spr == null) return null;
    const accepted = [spr];
    if (/^-?\d+\/\d+$/.test(spr)) {
      const [n, d] = spr.split('/').map(Number);
      let dd = Math.abs(d);
      while (dd % 2 === 0) dd /= 2;
      while (dd % 5 === 0) dd /= 5;
      if (dd === 1) {
        const dec = String(Number((n / d).toFixed(10)) / 1);
        if (dec !== spr) accepted.push(dec);
      }
    } else if (/^-?\d+(\.\d+)?$/.test(spr) && !Number.isInteger(Number(spr))) {
      const v = Number(spr);
      for (const d of [2, 4, 5, 8, 10, 16, 20, 25, 50, 100]) {
        const n = Math.round(v * d);
        if (Math.abs(n / d - v) < 1e-12) {
          accepted.push(fracPlain(n, d));
          break;
        }
      }
    }
    return { ...base, type: 'spr', answer: spr, accepted_spr: [...new Set(accepted)] };
  }

  const correct = body.num;
  const correctText = choiceTex(body.text);
  const chosen = [{ v: correct, t: correctText, note: 'correct', tag: 'none' }];
  const seen = new Set([keyOf(correct, correctText)]);
  const texts = new Set([correctText]);
  for (const tup of body.alts) {
    let v;
    let t;
    let note;
    let tag;
    if (tup.length >= 4) {
      [v, t, note, tag] = tup;
    } else if (typeof tup[0] === 'string') {
      [t, note, tag] = tup;
      v = null;
    } else {
      [v, note, tag] = tup;
      t = formatLike(body.text, v);
    }
    if (t == null) t = num(v);
    t = choiceTex(t);
    const k = keyOf(v, t);
    if (seen.has(k) || texts.has(t)) continue;
    if (typeof v === 'number' && typeof correct === 'number' && Math.abs(v - correct) <= EPS) continue;
    seen.add(k);
    texts.add(t);
    chosen.push({ v, t, note, tag });
    if (chosen.length === 4) break;
  }
  // deterministic, plausible fillers if a distractor collided
  const fillPool = [];
  if (typeof correct === 'number' && Number.isFinite(correct)) {
    fillPool.push(
      [correct * 2, 'doubled the result instead of applying the rate once', 'setup'],
      [correct / 2, 'used half of the correct quantity', 'setup'],
      [correct + 1, 'arithmetic slip of one unit', 'arithmetic'],
      [correct - 1, 'arithmetic slip of one unit', 'arithmetic'],
      [correct + 10, 'added the rate instead of multiplying by it', 'setup'],
      [-correct, 'dropped the sign', 'sign'],
      [Math.round(correct * 1.1 * 1e6) / 1e6, 'increased the result by 10 percent for no reason', 'arithmetic'],
      [Math.round(correct * 0.9 * 1e6) / 1e6, 'decreased the result by 10 percent for no reason', 'arithmetic']
    );
  }
  for (const [v, note, tag] of fillPool) {
    if (chosen.length === 4) break;
    const t = num(v);
    const k = keyOf(v, t);
    if (seen.has(k) || Math.abs(v - correct) <= EPS) continue;
    seen.add(k);
    chosen.push({ v, t, note, tag });
  }
  if (chosen.length !== 4) return null;

  const order = r.shuffle([0, 1, 2, 3]);
  const shuffled = order.map((i) => chosen[i]);
  const keyIdx = shuffled.findIndex((c) => c.note === 'correct');
  return {
    ...base,
    type: 'mcq',
    choices: shuffled.map((c) => c.t),
    answer: LETTER[keyIdx],
    choice_notes: shuffled.map((c) => c.note),
    error_tags: shuffled.map((c) => c.tag),
  };
}

/* ================================================================== *
 * 5. Generator registry
 * ================================================================== */

const REG = [];
function reg(entry) {
  REG.push(entry);
}

/* ================================================================== *
 * 6. PROBLEM-SOLVING AND DATA ANALYSIS
 * ================================================================== */

/* ---- ratios and rates ---- */
function gRatioParts(r, L) {
  const ctx = r.pick([
    { intro: 'A trail mix is made from raisins and almonds.', a: 'raisins', b: 'almonds', unit: 'ounces' },
    { intro: 'A paint color is mixed from blue and yellow pigment.', a: 'blue pigment', b: 'yellow pigment', unit: 'milliliters' },
    { intro: 'A concrete blend uses sand and gravel.', a: 'sand', b: 'gravel', unit: 'pounds' },
    { intro: 'A fruit drink is blended from cranberry juice and apple juice.', a: 'cranberry juice', b: 'apple juice', unit: 'liters' },
    { intro: 'A snack mix combines cashews and pretzels.', a: 'cashews', b: 'pretzels', unit: 'grams' },
  ]);
  const a = r.int(2, 4 + L);
  let b = r.int(2, 5 + L);
  if (b === a) b = a + 1;
  while (gcd(a, b) !== 1) b = b + 1;
  const per = r.int(2, 6 + 2 * L);
  const total = (a + b) * per;
  const ans = a * per;
  const capA = ctx.a.charAt(0).toUpperCase() + ctx.a.slice(1);
  const stem = `${ctx.intro} The two ingredients are combined in the ratio $${a}:${b}$. A batch contains ${total} ${ctx.unit} of the mixture. How many ${ctx.unit} of ${ctx.a} are in the batch?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [b * per, `swapped the two parts of the ratio and used $${b}$ parts of ${ctx.a}`, 'setup'],
      [per, 'divided the total by the number of parts and stopped there', 'concept'],
      [(a + 1) * per, 'used one extra part of the ratio for the ingredient asked about', 'setup'],
    ],
    stem,
    expl: `The ratio has $${a}+${b}=${a + b}$ equal parts, so one part is $${total}\\div${a + b}=${per}$ ${ctx.unit}. Of those ${a + b} parts, $${a}$ are ${ctx.a}, so the batch contains $${a}\\times${per}=${ans}$ ${ctx.unit}.`,
    desmos: `${total}/(${a}+${b})*${a}`,
    note: 'The trap is treating the ratio numbers as amounts instead of as counts of equal parts.',
    check: `verified $${a}\\times${per}+${b}\\times${per}=${total}$ equals the stated batch size`,
  };
}
reg({ fn: gRatioParts, domain: DATA_DOMAIN, skill: 'Ratios and rates', count: 11, spr: true });

/* ---- unit conversion via dimensional analysis ---- */
function gUnitConvert(r, L) {
  const kind = r.int(0, 4 + (L >= 2 ? 1 : 0));
  let stem, ans, alts, expl, desmos, note, check, unit;

  if (kind === 0) {
    // km/h -> m/s
    const v = r.pick([18, 36, 54, 72, 90, 108, 126, 144, 162, 180]);
    ans = Math.round((v * 1000) / 3600 * 1e6) / 1e6;
    unit = 'meters per second';
    stem = `A train travels at a constant speed of $${v}$ kilometers per hour. What is this speed in meters per second?`;
    alts = [
      [Math.round(v * 3.6 * 1e6) / 1e6, 'multiplied by $3.6$ instead of dividing by it', 'concept'],
      [Math.round((v * 1000) / 60 * 1e6) / 1e6, 'converted hours to minutes instead of to seconds', 'unit'],
      [Math.round((v / 1000) * 3600 * 1e6) / 1e6, 'inverted the kilometer-to-meter factor', 'unit'],
    ];
    expl = `Multiply by the conversion factors so the units cancel: $${v}\\ \\frac{\\text{km}}{\\text{h}}\\cdot\\frac{1000\\ \\text{m}}{1\\ \\text{km}}\\cdot\\frac{1\\ \\text{h}}{3600\\ \\text{s}}=\\frac{${v * 1000}}{3600}=${num(ans)}$ meters per second.`;
    desmos = `${v}*1000/3600`;
    note = 'Dimensional analysis: both conversion factors must be oriented so km and h cancel.';
    check = `recomputed as $${v}\\div3.6=${num(ans)}$`;
    return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
  }

  if (kind === 1) {
    // pages per minute -> pages per h hours
    const p = r.int(8, 40 + 10 * L);
    const h = r.int(2, 3 + L);
    ans = p * 60 * h;
    stem = `A printer prints ${p} pages per minute. At this constant rate, how many pages does it print in ${h} hours?`;
    alts = [
      [p * 60, 'computed the pages in one hour and stopped', 'setup'],
      [p * h, 'multiplied by the hours but never converted minutes to hours', 'unit'],
      [p * 100 * h, 'used 100 minutes in an hour', 'unit'],
    ];
    expl = `Each hour has $60$ minutes, so the printer produces $${p}\\times60=${p * 60}$ pages per hour. In ${h} hours that is $${p * 60}\\times${h}=${ans}$ pages. Two factors are at work: minutes per hour and the number of hours.`,
    desmos = `${p}*60*${h}`;
    note = 'Two separate factors: minutes-to-hours and the number of hours.';
    check = `recomputed rate per hour (${p}*60=${p * 60}) then multiplied by ${h}`;
    return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
  }

  if (kind === 2) {
    // cm -> inches at 2.54
    const k = r.int(6, 20 + 4 * L);
    const cm = Math.round(2.54 * k * 100) / 100;
    ans = k;
    stem = `A board is ${num(cm)} centimeters long. Given that $1$ inch is $2.54$ centimeters, what is the length of the board in inches?`;
    alts = [
      [Math.round(cm * 2.54 * 100) / 100, 'multiplied by $2.54$ instead of dividing by it', 'concept'],
      [Math.round((cm / 12) * 100) / 100, 'divided by $12$ as if converting centimeters to feet', 'unit'],
      [Math.round((cm / 25.4) * 100) / 100, 'used $25.4$ centimeters per inch', 'unit'],
    ];
    expl = `Divide by the number of centimeters in one inch: $${num(cm)}\\div2.54=${ans}$ inches. Inches are the longer unit, so the count in inches is smaller than the count in centimeters.`,
    desmos = `${num(cm)}/2.54`;
    note = 'Centimeters are the smaller unit, so the count in inches must be smaller.';
    check = `multiplied back: $${ans}\\times2.54=${num(cm)}$ cm`;
    return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
  }

  if (kind === 3) {
    // kg -> lb at 2.2
    const m = r.int(4, 20 + 5 * L);
    ans = Math.round(m * 2.2 * 1e6) / 1e6;
    stem = `A crate has a mass of ${m} kilograms. Given that $1$ kilogram is approximately $2.2$ pounds, what is the mass of the crate in pounds?`;
    alts = [
      [Math.round((m / 2.2) * 1e6) / 1e6, 'divided by $2.2$ instead of multiplying', 'concept'],
      [Math.round(m * 22 * 1e6) / 1e6, 'used $22$ pounds per kilogram', 'unit'],
      [m + 2.2, 'added the conversion factor instead of multiplying', 'concept'],
    ];
    expl = `Each kilogram is $2.2$ pounds, so multiply: $${m}\\times2.2=${num(ans)}$ pounds. Pounds are the smaller unit, so the number of pounds is larger than the number of kilograms.`,
    desmos = `${m}*2.2`;
    note = 'Pounds are the smaller unit, so the number of pounds must be larger than the number of kilograms.';
    check = `divided back: $${num(ans)}\\div2.2=${m}$ kg`;
    return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
  }

  if (kind === 4) {
    // liters/min -> kiloliters over h hours
    const per = r.pick([40, 50, 60, 80, 100, 120, 150, 200]);
    const h = r.int(2, 4 + L);
    ans = Math.round(((per * 60 * h) / 1000) * 1e6) / 1e6;
    stem = `A pump moves water at a rate of ${per} liters per minute. How many kiloliters does it move in ${h} hours?`;
    alts = [
      [Math.round(per * 60 * h * 1e6) / 1e6, 'reported the amount in liters, not kiloliters', 'unit'],
      [Math.round((per * h) / 1000 * 1e6) / 1e6, 'forgot to convert minutes to hours', 'unit'],
      [Math.round(((per * 60 * h) / 100) * 1e6) / 1e6, 'divided by $100$ liters per kiloliter', 'unit'],
    ];
    expl = `In ${h} hours the pump moves $${per}\\times60\\times${h}=${per * 60 * h}$ liters. Since $1000$ liters make a kiloliter, that is $${per * 60 * h}\\div1000=${num(ans)}$ kiloliters.`;
    desmos = `${per}*60*${h}/1000`;
    note = 'Three factors chained: rate, minutes per hour, hours — then the liter-to-kiloliter step.';
    check = `multiplied back: $${num(ans)}\\times1000=${per * 60 * h}$ liters`;
    return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
  }

  // kind 5: gallons -> pints through quarts
  const g = r.int(3, 12 + 3 * L);
  ans = g * 8;
  stem = `A cooler holds ${g} gallons of sports drink. Given that $1$ gallon is $4$ quarts and $1$ quart is $2$ pints, how many pints does the cooler hold?`;
  alts = [
    [g * 4, 'converted to quarts and stopped', 'setup'],
    [g * 2, 'used $2$ pints per gallon', 'unit'],
    [Math.round((g * 4) / 2 * 1e6) / 1e6, 'divided by $2$ instead of multiplying', 'unit'],
  ];
  expl = `Each gallon is $4$ quarts, and each quart is $2$ pints, so one gallon is $8$ pints. Thus ${g} gallons is $${g}\\times8=${ans}$ pints.`;
  desmos = `${g}*4*2`;
  note = 'Chained conversions must be multiplied, not divided.';
  check = `checked $${g}\\times4=${g * 4}$ quarts and $${g * 4}\\times2=${ans}$ pints`;
  return { num: ans, text: num(ans), spr: num(ans), alts, stem, expl, desmos, note, check };
}
reg({ fn: gUnitConvert, domain: DATA_DOMAIN, skill: 'Unit conversion', count: 11, spr: true });

/* ---- unit rate ---- */
function gUnitRate(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const q = r.int(4, 8 + L);
    const cents = r.int(6, 60 + 10 * L) * 5; // multiple of 5 cents
    const total = Math.round((cents * q) / 100 * 100) / 100;
    const ans = cents / 100;
    const stem = `A package of ${q} identical batteries costs ${moneyTex(total)}. What is the cost per battery?`;
    return {
      num: ans,
      text: moneyTex(ans),
      spr: num(ans),
      alts: [
        [Math.round((q / total) * 100) / 100, 'divided the number of batteries by the price instead of the reverse', 'concept'],
        [total, 'gave the price of the whole package', 'quantity'],
        [Math.round(((total * q)) * 100) / 100, 'multiplied price by quantity', 'setup'],
      ],
      stem,
      expl: `Divide the total cost by the number of batteries: $${num(total)}\\div${q}=${num(ans)}$ dollars, so each battery costs ${moneyTex(ans)}. Dividing by the count is what turns a total into a per-item rate.`,
      desmos: `${num(total)}/${q}`,
      note: 'A unit rate always puts the quantity of interest in the denominator.',
      check: `multiplied back: $${num(ans)}\\times${q}=${num(total)}$`,
    };
  }
  if (kind === 1) {
    const gal = r.int(3, 8 + L);
    const mpg = r.int(20, 35 + 5 * L);
    const miles = gal * mpg;
    const ans = mpg;
    const stem = `A car uses ${gal} gallons of gasoline to travel ${miles} miles. What is the car's fuel efficiency in miles per gallon?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [Math.round((gal / miles) * 1e6) / 1e6, 'divided gallons by miles', 'concept'],
        [miles, 'gave the total distance instead of the rate', 'quantity'],
        [Math.round(miles * gal * 1e6) / 1e6, 'multiplied distance by gallons', 'setup'],
      ],
      stem,
      expl: `Miles per gallon means miles divided by gallons: $${miles}\\div${gal}=${ans}$ miles per gallon. The order of the division comes from the units in the rate's name.`,
      desmos: `${miles}/${gal}`,
      note: 'Read the units off the rate name: "miles per gallon" fixes the division order.',
      check: `multiplied back: $${ans}\\times${gal}=${miles}$ miles`,
    };
  }
  const perHour = r.int(6, 12 + L);
  const hours = r.int(3, 7 + L);
  const ans = perHour * hours;
  const stem = `A factory produces ${perHour} widgets every hour. At this rate, how many widgets does it produce in ${hours} hours?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [perHour, 'gave the hourly rate instead of the total', 'quantity'],
      [perHour + hours, 'added the hours to the rate', 'setup'],
      [perHour * 60, 'multiplied by $60$ minutes with no conversion needed', 'unit'],
    ],
    stem,
    expl: `Multiply the hourly rate by the number of hours: $${perHour}\\times${hours}=${ans}$ widgets. The rate is already per hour, so no unit conversion is needed.`,
    desmos: `${perHour}*${hours}`,
    note: 'The rate is already per hour, so the only step is multiplying by hours.',
    check: `divided back: $${ans}\\div${hours}=${perHour}$`,
  };
}
reg({ fn: gUnitRate, domain: DATA_DOMAIN, skill: 'Unit rate', count: 10, spr: true });

/* ---- percent of a number ---- */
function gPercentOf(r, L) {
  if (r.chance(0.45)) {
    const n = r.pick([40, 60, 80, 120, 150, 200, 240, 300, 400, 480]) * (L >= 2 ? 1 : 1);
    const p = r.pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
    const ans = Math.round(((p * n) / 100) * 1e6) / 1e6;
    const stem = `What is ${pctTex(p)} of ${n}?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [Math.round(n * (1 + p / 100) * 1e6) / 1e6, 'increased the number by the percent instead of taking the percent of it', 'concept'],
        [Math.round(((p * n) / 10) * 1e6) / 1e6, 'divided by $10$ instead of $100$', 'arithmetic'],
        [Math.round((n - ans) * 1e6) / 1e6, 'found the part of the number that is not in the percent', 'misread'],
      ],
      stem,
      expl: `Convert the percent to a decimal and multiply: $${num(p / 100)}\\times${n}=${num(ans)}$. The remaining $${num(n - ans)}$ is the part of ${n} that the percent does not count.`,
      desmos: `${p}/100*${n}`,
      note: 'Percent means per hundred, so the decimal is the percent divided by $100$.',
      check: `divided back: $${num(ans)}\\div${n}\\times100=${num(Math.round((ans / n) * 100 * 1e6) / 1e6)}$ percent`,
    };
  }
  const base = r.pick([25, 40, 50, 80, 120, 160, 200, 250]);
  const p = r.pick([12, 15, 20, 25, 30, 40, 45, 60, 75, 80]);
  const part = Math.round(((p * base) / 100) * 1e6) / 1e6;
  const stem = `The number ${num(part)} is what percent of ${base}?`;
  return {
    num: p,
    text: num(p),
    spr: num(p),
    alts: [
      [Math.round(((base / part) * 100) * 1e6) / 1e6, 'inverted the ratio', 'concept'],
      [Math.round(((part / base) * 1000) * 1e6) / 1e6, 'used $1000$ instead of $100$ in the conversion', 'arithmetic'],
      [Math.round(((base - part) / base) * 100 * 1e6) / 1e6, 'computed the percent not taken', 'misread'],
    ],
    stem,
    expl: `Divide the part by the whole and multiply by $100$: $${num(part)}\\div${base}\\times100=${p}$ percent. Multiplying back, $${base}\\times${num(p / 100)}=${num(part)}$ confirms the percent.`,
    desmos: `${num(part)}/${base}*100`,
    note: '"What percent of" always means part divided by whole.',
    check: `multiplied back: $${base}\\times${num(p / 100)}=${num(part)}$`,
  };
}
reg({ fn: gPercentOf, domain: DATA_DOMAIN, skill: 'Percent of a number', count: 10, spr: true });

/* ---- percent increase / decrease ---- */
function gPercentChange(r, L) {
  if (r.chance(0.5)) {
    const old = r.pick([20, 40, 50, 60, 80, 120, 150, 200, 250, 400]);
    const p = r.pick([5, 8, 10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75]);
    const up = r.chance(0.5);
    const ans = Math.round(old * (up ? 1 + p / 100 : 1 - p / 100) * 1e6) / 1e6;
    const stem = `A quantity of ${old} ${up ? 'increases' : 'decreases'} by ${pctTex(p)}. What is the new value of the quantity?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [Math.round(old * (up ? 1 - p / 100 : 1 + p / 100) * 1e6) / 1e6, up ? 'subtracted the percent instead of adding it' : 'added the percent instead of subtracting it', 'sign'],
        [Math.round(((p * old) / 100) * 1e6) / 1e6, 'computed the size of the change and stopped there', 'quantity'],
        [old + p, 'added the percent number itself to the quantity', 'concept'],
      ],
      stem,
      expl: `A ${p} percent ${up ? 'increase multiplies by' : 'decrease multiplies by'} $1${up ? '+' : '-'}${num(p / 100)}=${num(up ? 1 + p / 100 : 1 - p / 100)}$, so the new value is $${old}\\times${num(up ? 1 + p / 100 : 1 - p / 100)}=${num(ans)}$. The change itself is $${num(Math.abs(ans - old))}$, which is ${p} percent of the original ${old}.`,
      desmos: `${old}*${up ? 1 + p / 100 : 1 - p / 100}`,
      note: 'Multiply by the growth factor rather than adding a percent to a number.',
      check: `divided back: $${num(ans)}\\div${old}=${num(Math.round((ans / old) * 1e6) / 1e6)}$`,
    };
  }
  const old = r.pick([40, 50, 80, 120, 160, 200, 250, 400]);
  const p = r.pick([10, 12, 15, 20, 25, 30, 40, 50, 60, 75]);
  const up = r.chance(0.5);
  const neu = Math.round(old * (up ? 1 + p / 100 : 1 - p / 100) * 1e6) / 1e6;
  const diff = Math.round((neu - old) * 1e6) / 1e6;
  const stem = `A store's daily sales were ${moneyTex(old)} on Monday and ${moneyTex(neu)} on Tuesday. What was the percent ${up ? 'increase' : 'decrease'} from Monday to Tuesday?`;
  return {
    num: p,
    text: num(p),
    spr: num(p),
    alts: [
      [Math.round((diff / neu) * 100 * 1e6) / 1e6, 'divided the change by the new value instead of the original', 'concept'],
      [Math.abs(diff), 'gave the dollar change instead of a percent', 'quantity'],
      [Math.round((-diff / old) * 100 * 1e6) / 1e6, 'reversed the sign of the change', 'sign'],
    ],
    stem,
    expl: `The change is $${num(neu)}-${num(old)}=${num(diff)}$. Divide by the original value and multiply by $100$: $${num(diff)}\\div${old}\\times100=${p}$ percent.`,
    desmos: "(" + num(neu) + "-" + num(old) + ")/" + old + "*100",
    note: 'Percent change is always measured against the original (starting) value.',
    check: `multiplied back: $${old}\\times(1${up ? '+' : '-'}${num(p / 100)})=${num(neu)}$`,
  };
}
reg({ fn: gPercentChange, domain: DATA_DOMAIN, skill: 'Percent increase and decrease', count: 10, spr: true });

/* ---- percent change chains ---- */
function gPercentChain(r, L) {
  const base = r.pick([200, 400, 500, 800, 1000, 1200]);
  const p = r.pick([10, 12, 15, 20, 25, 30, 40, 50]);
  let q = r.pick([10, 15, 20, 25, 30, 40, 50]);
  if (q === p) q = q === 50 ? 40 : q + 10;
  const upFirst = r.chance(0.7);
  const f1 = upFirst ? 1 + p / 100 : 1 - p / 100;
  const f2 = 1 - q / 100;
  const ans = Math.round(base * f1 * f2 * 100) / 100;
  const stem = `A stock price starts at ${moneyTex(base)}. It ${upFirst ? 'rises' : 'falls'} by ${pctTex(p)} during the first month, then falls by ${pctTex(q)} during the second month. What is the price after the second month?`;
  return {
    num: ans,
    text: moneyTex(ans),
    spr: num(ans),
    alts: [
      [Math.round(base * (1 + (upFirst ? p - q : -p - q) / 100) * 1e6) / 1e6, 'combined the two percents by adding them before applying either', 'concept'],
      [Math.round(base * f1 * 1e6) / 1e6, 'applied only the first month\'s change', 'setup'],
      [Math.round(base * f1 * (1 + q / 100) * 1e6) / 1e6, 'applied the second change as an increase', 'sign'],
    ],
    stem,
    expl: `Apply the changes one after another: $${base}\\times${num(f1)}\\times${num(f2)}=${num(ans)}$. The two percents cannot simply be subtracted, because the second change is taken on the already-changed price.`,
    desmos: `${base}*${num(f1)}*${num(f2)}`,
    note: 'Successive percent changes multiply; their rates do not add.',
    check: `divided back by both factors: $${num(ans)}\\div${num(f1)}\\div${num(f2)}=${base}$`,
  };
}
reg({ fn: gPercentChain, domain: DATA_DOMAIN, skill: 'Percent change chains', count: 11, spr: true });

/* ---- find the original given a percent change ---- */
function gPercentOriginal(r, L) {
  const orig = r.pick([40, 60, 80, 120, 150, 200, 250, 300, 400, 500]);
  const p = r.pick([10, 15, 20, 25, 30, 40, 50, 60, 75]);
  const up = r.chance(0.6);
  const neu = Math.round(orig * (up ? 1 + p / 100 : 1 - p / 100) * 1e6) / 1e6;
  const stem = `After a ${pctTex(p)} ${up ? 'increase' : 'decrease'}, a quantity is equal to ${num(neu)}. What was the quantity before the change?`;
  return {
    num: orig,
    text: num(orig),
    spr: num(orig),
    alts: [
      [Math.round(neu * (up ? 1 - p / 100 : 1 + p / 100) * 1e6) / 1e6, 'applied the percent change to the final value in the opposite direction', 'concept'],
      [Math.round((neu / (up ? 1 - p / 100 : 1 + p / 100)) * 1e6) / 1e6, 'divided by the wrong growth factor', 'setup'],
      [Math.round(((neu * p) / 100) * 1e6) / 1e6, 'computed the amount of the change instead of the original value', 'quantity'],
    ],
    stem,
    expl: `If the original value is $x$, then $x\\left(${num(up ? 1 + p / 100 : 1 - p / 100)}\\right)=${num(neu)}$, so $x=${num(neu)}\\div${num(up ? 1 + p / 100 : 1 - p / 100)}=${orig}$. Dividing by the growth factor undoes the percent change in a single step.`,
    desmos: `${num(neu)}/${num(up ? 1 + p / 100 : 1 - p / 100)}`,
    note: 'Undo a percent change by dividing by the growth factor, not by subtracting the percent.',
    check: `multiplied back: $${orig}\\times${num(up ? 1 + p / 100 : 1 - p / 100)}=${num(neu)}$`,
  };
}
reg({ fn: gPercentOriginal, domain: DATA_DOMAIN, skill: 'Finding the original amount', count: 10, spr: true });

/* ---- percent more / less than ---- */
function gPercentMoreLess(r, L) {
  const mode = r.int(0, 2);
  if (mode === 0) {
    const y = r.pick([40, 60, 80, 120, 160, 200, 240, 300, 400]);
    const p = r.pick([10, 15, 20, 25, 30, 40, 50, 60, 75]);
    const x = Math.round(y * (1 - p / 100) * 1e6) / 1e6;
    const stem = `The number $x$ is ${pctTex(p)} less than the number $y$. If $y=${y}$, what is $x$?`;
    return {
      num: x,
      text: num(x),
      spr: num(x),
      alts: [
        [Math.round(y * (1 + p / 100) * 1e6) / 1e6, 'increased instead of decreasing', 'sign'],
        [Math.round(((p * y) / 100) * 1e6) / 1e6, 'gave the amount of the decrease rather than the resulting value', 'quantity'],
        [y - p, 'subtracted the percent number itself', 'concept'],
      ],
      stem,
      expl: `"${p} percent less than $y$" means $y\\left(1-${num(p / 100)}\\right)=${y}\\times${num(1 - p / 100)}=${num(x)}$.`,
      desmos: `${y}*(1-${num(p / 100)})`,
      note: 'The percent is taken on $y$, the number that follows "than".',
      check: `divided back: $${num(x)}\\div${y}=${num(1 - p / 100)}$`,
    };
  }
  if (mode === 1) {
    const p = r.pick([20, 25, 40, 50, 60, 75, 80]);
    const ans = Math.round(((100 * p) / (100 - p)) * 1e6) / 1e6;
    const stem = `The number $x$ is ${pctTex(p)} less than the number $y$. The number $y$ is what percent more than $x$?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [p, 'assumed the two percent comparisons are the same', 'concept'],
        [Math.round(((100 * p) / (100 + p)) * 1e6) / 1e6, 'used the wrong base for the comparison', 'setup'],
        [Math.round((100 - p) * 1e6) / 1e6, 'gave the complement of the percent', 'quantity'],
      ],
      stem,
      expl: `Take $x=100-p$ and $y=100$. Then $y$ exceeds $x$ by $p$, and as a percent of $x$ that is $\\frac{p}{100-p}\\times100=${num(ans)}$ percent.`,
      desmos: `${p}/(100-${p})*100`,
      note: 'The base changes: a $p$ percent decrease is undone by a larger percent increase.',
      check: `checked with $x=${num(100 - p)}$, $y=100$: increase $=${p}$, and $${p}\\div${num(100 - p)}\\times100=${num(ans)}$`,
    };
  }
  const p = r.pick([25, 50, 100, 150, 400]);
  const ans = Math.round(((100 * p) / (100 + p)) * 1e6) / 1e6;
  const stem = `The number $y$ is ${pctTex(p)} more than the number $x$. The number $x$ is what percent less than $y$?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [p, 'assumed the two percent comparisons are the same', 'concept'],
      [Math.round(((100 * p) / (100 - p)) * 1e6) / 1e6, 'used the wrong base for the comparison', 'setup'],
      [100 - p, 'subtracted the percent from $100$', 'quantity'],
    ],
    stem,
    expl: `Take $x=100$ and $y=100+p$. Then $x$ is $p$ below $y$, which as a percent of $y$ is $\\frac{p}{100+p}\\times100=${num(ans)}$ percent.`,
    desmos: `${p}/(100+${p})*100`,
    note: 'A percent increase and the percent decrease that undoes it are never equal.',
    check: `checked with $x=100$, $y=${100 + p}$: $${p}\\div${100 + p}\\times100=${num(ans)}$`,
  };
}
reg({ fn: gPercentMoreLess, domain: DATA_DOMAIN, skill: 'Percent more than and less than', count: 10, spr: true });

/* ---- markup and discount ---- */
function gMarkupDiscount(r, L) {
  const cost = r.pick([20, 24, 30, 40, 45, 50, 60, 80, 120, 150, 200]);
  const m = r.pick([10, 20, 25, 30, 40, 50, 60]);
  const d = r.pick([10, 15, 20, 25, 30, 40, 50]);
  const final = Math.round(cost * (1 + m / 100) * (1 - d / 100) * 100) / 100;
  const stem = `A store buys a jacket for ${moneyTex(cost)}. The store marks the price up by ${pctTex(m)}, then later sells the jacket at ${pctTex(d)} off the marked price. What is the selling price?`;
  return {
    num: final,
    text: moneyTex(final),
    spr: num(final),
    alts: [
      [cost, 'assumed the discount exactly cancels the markup', 'concept'],
      [Math.round(cost * (1 + (m - d) / 100) * 1e6) / 1e6, 'subtracted the percents before applying either one', 'setup'],
      [Math.round(cost * (1 + m / 100) * 1e6) / 1e6, 'applied the markup but not the discount', 'setup'],
    ],
    stem,
    expl: `The marked price is $${cost}\\times${num(1 + m / 100)}=${num(Math.round(cost * (1 + m / 100) * 100) / 100)}$, and the selling price is that amount times $${num(1 - d / 100)}$, which is ${moneyTex(final)}.`,
    desmos: `${cost}*(1+${num(m / 100)})*(1-${num(d / 100)})`,
    note: 'A $p$ percent markup followed by a $p$ percent discount does not return to the original price.',
    check: `divided back by both factors: $${num(final)}\\div${num(1 + m / 100)}\\div${num(1 - d / 100)}=${cost}$`,
  };
}
reg({ fn: gMarkupDiscount, domain: DATA_DOMAIN, skill: 'Markup and discount', count: 10, spr: true });

/* ---- mean, median, mode, range ---- */
function gMeanMedianMode(r, L) {
  const n = r.pick([5, 5, 7]);
  const base = r.int(4, 12 + L);
  const vals = [];
  for (let i = 0; i < n; i++) vals.push(base + r.int(0, 6 + L));
  // guarantee a unique mode
  const modeVal = vals[1];
  vals[2] = modeVal;
  vals[3] = modeVal;
  for (let i = 4; i < n; i++) if (vals[i] === modeVal) vals[i] = modeVal + 1 + (i - 4);
  if (vals[0] === modeVal) vals[0] = modeVal - 1;
  const sorted = [...vals].sort((x, y) => x - y);
  const sum = vals.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = sorted[(n - 1) / 2];
  const range = sorted[n - 1] - sorted[0];
  const ask = r.pick(['mean', 'median', 'mode', 'range']);

  let ans, text, alts, expl, note;
  if (ask === 'mean') {
    ans = mean;
    text = Number.isInteger(mean) ? String(mean) : frac(sum, n);
    alts = [
      [median, 'gave the median instead of the mean', 'concept'],
      [Math.round((sum / (n + 1)) * 1e6) / 1e6, 'divided the sum by one too many values', 'arithmetic'],
      [range, 'gave the range instead of the mean', 'misread'],
    ];
    expl = `The mean is the sum divided by the count: $(${vals.join('+')})\\div${n}=${sum}\\div${n}=${text}$. Every value contributes to the mean, which is why it can sit between two of the listed values.`;
    note = 'Mean and median are different measures; the mean uses every value.';
  } else if (ask === 'median') {
    ans = median;
    text = String(median);
    alts = [
      [Math.round(mean * 1e6) / 1e6, 'averaged all the values instead of taking the middle one', 'concept'],
      [sorted[(n - 1) / 2 + 1] != null ? sorted[(n - 1) / 2 + 1] : median + 1, 'picked the next value after the middle one', 'misread'],
      [Math.round(((sorted[0] + sorted[n - 1]) / 2) * 1e6) / 1e6, 'averaged the smallest and largest values', 'setup'],
    ];
    expl = `Sorted, the values are $${sorted.join(', ')}$. With ${n} values the median is the middle one, ${median}. Position determines the median, so extreme values cannot pull it.`;
    note = 'Sort first — the median is positional, not an average of all values.';
  } else if (ask === 'mode') {
    ans = modeVal;
    text = String(modeVal);
    alts = [
      [Math.round(mean * 1e6) / 1e6, 'gave the mean instead of the most frequent value', 'concept'],
      [median, 'gave the median instead of the most frequent value', 'concept'],
      [sorted[n - 1], 'gave the largest value', 'misread'],
    ];
    expl = `The value ${modeVal} appears more often than any other, so the mode is ${modeVal}. Mode counts frequency, while the mean and median measure the size of the values.`;
    note = 'The mode is about frequency, not position or size.';
  } else {
    ans = range;
    text = String(range);
    alts = [
      [sorted[n - 1] + sorted[0], 'added the largest and smallest values instead of subtracting', 'sign'],
      [Math.round(mean * 1e6) / 1e6, 'gave the mean instead of the spread', 'concept'],
      [sorted[n - 1], 'gave the maximum value only', 'misread'],
    ];
    expl = `The range is the largest value minus the smallest: $${sorted[n - 1]}-${sorted[0]}=${range}$. The range uses only the two extreme values, so a single outlier can change it dramatically.`;
    note = 'Range measures spread between the extremes, not an average.';
  }

  const list = vals.join(', ');
  return {
    num: ans,
    text,
    spr: ask === 'mean' && !Number.isInteger(mean) ? fracPlain(sum, n) : String(ans),
    alts,
    stem: `A data set contains the ${n} values ${list}. What is the ${ask} of the data set?`,
    expl,
    desmos: `mean(${vals.join(',')})`,
    note,
    check: `recomputed sorted=${sorted.join(',')} sum=${sum} mean=${num(mean)} median=${median} range=${range}`,
  };
}
reg({ fn: gMeanMedianMode, domain: DATA_DOMAIN, skill: 'Mean, median, mode, and range', count: 11, spr: true });

/* ---- effect of an outlier ---- */
function gOutlierEffect(r, L) {
  const n = r.pick([5, 6, 7]);
  const base = r.int(10, 20);
  const vals = [];
  for (let i = 0; i < n - 1; i++) vals.push(base + r.int(0, 4));
  const outlier = base + r.int(20, 40 + 12 * L);
  const withO = [...vals, outlier];
  const sumNo = vals.reduce((a, b) => a + b, 0);
  const meanNo = sumNo / (n - 1);
  const meanWith = (sumNo + outlier) / n;
  const ans = Math.round((meanWith - meanNo) * 1e4) / 1e4;
  const stem = `A data set of ${n - 1} values has a mean of ${num(Math.round(meanNo * 100) / 100)}. A single additional value, ${outlier}, is then included in the data set. By how much does the mean increase?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [Math.round((meanNo - meanWith) * 1e4) / 1e4, 'reversed the direction of the change', 'sign'],
      [Math.round((outlier / n) * 1e4) / 1e4, 'divided the outlier by the new count but ignored the existing sum', 'setup'],
      [Math.round((outlier - meanNo) * 1e4) / 1e4, 'gave the gap between the outlier and the old mean', 'concept'],
    ],
    stem,
    expl: `The original sum is $${n - 1}\\times${num(Math.round(meanNo * 100) / 100)}=${sumNo}$, so the new mean is $(${sumNo}+${outlier})\\div${n}=${num(Math.round(meanWith * 1e4) / 1e4)}$. The increase is $${num(Math.round(meanWith * 1e4) / 1e4)}-${num(Math.round(meanNo * 100) / 100)}=${num(ans)}$.`,
    desmos: `(${sumNo}+${outlier})/${n}`,
    note: 'Adding a value changes both the sum and the count — the mean moves less than the outlier suggests.',
    check: `recomputed the new mean from the reconstructed sum and subtracted the given mean`,
  };
}
reg({ fn: gOutlierEffect, domain: DATA_DOMAIN, skill: 'Effect of an outlier', count: 9, spr: true });

/* ---- comparing standard deviations ---- */
function gCompareSD(r, L) {
  const m = r.int(40, 70);
  const tight = r.int(1, 2);
  const wide = r.int(8, 14 + 2 * L);
  const A = [m - 2 * tight, m - tight, m, m + tight, m + 2 * tight];
  const B = [m - wide, m - Math.round(wide / 2), m, m + Math.round(wide / 2) + 1, m + wide - 1];
  // force both sets to the same mean
  const fix = (arr) => {
    const s = arr.reduce((x, y) => x + y, 0);
    arr[2] = arr[2] - (s - arr.length * m);
    return arr;
  };
  fix(A);
  fix(B);
  const sd = (arr) => {
    const mu = arr.reduce((x, y) => x + y, 0) / arr.length;
    return Math.sqrt(arr.reduce((x, y) => x + (y - mu) ** 2, 0) / arr.length);
  };
  const sdA = sd(A);
  const sdB = sd(B);
  const widerIsB = sdB > sdA;
  return {
    num: null,
    text: widerIsB ? 'Data set B' : 'Data set A',
    alts: [
      [widerIsB ? 1 : 2, widerIsB ? 'Data set A' : 'Data set B', 'chose the more tightly clustered set', 'concept'],
      [0, 'The two standard deviations are equal', 'assumed equal spreads because the means are equal', 'concept'],
      [null, 'It cannot be determined from the values given', 'thought the raw values were insufficient', 'concept'],
    ].map(([v, t, note, tag]) => [v, t, note, tag]),
    stem: `Two data sets have the same mean.\n\nData set A: ${A.join(', ')}\n\nData set B: ${B.join(', ')}\n\nWhich data set has the greater standard deviation?`,
    expl: `Standard deviation measures the typical distance of the values from the mean. The values in ${widerIsB ? 'set B' : 'set A'} sit much farther from the common mean of ${m}, so ${widerIsB ? 'set B' : 'set A'} has the greater standard deviation.`,
    desmos: `stdev(${A.join(',')})\nstdev(${B.join(',')})`,
    note: 'Equal means say nothing about spread; the standard deviation is about distance from the mean.',
    check: `computed both population standard deviations numerically: A=${num(Math.round(sdA * 1e4) / 1e4)}, B=${num(Math.round(sdB * 1e4) / 1e4)}`,
    onlyText: true,
  };
}
reg({ fn: gCompareSD, domain: DATA_DOMAIN, skill: 'Comparing standard deviations', count: 10, spr: false });

/* ---- weighted average ---- */
function gWeightedAvg(r, L) {
  let n1 = r.int(6, 12 + 2 * L);
  let n2 = r.int(4, 12 + 2 * L);
  const a1 = r.int(60, 78);
  const a2 = r.int(80, 95);
  // prefer a combined mean that terminates cleanly
  for (let i = 0; i < 40; i++) {
    const t = n1 * a1 + n2 * a2;
    if (t % (n1 + n2) === 0 || String(Math.round((t / (n1 + n2)) * 100) / 100).split('.')[1]?.length <= 2) break;
    n2 = r.int(4, 12 + 2 * L);
  }
  const total = n1 * a1 + n2 * a2;
  const ans = Math.round((total / (n1 + n2)) * 1e4) / 1e4;
  const stem = `In one class, ${n1} students scored a mean of ${a1} on a test. In a second class, ${n2} students scored a mean of ${a2} on the same test. What is the mean score of all ${n1 + n2} students combined?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [Math.round(((a1 + a2) / 2) * 1e4) / 1e4, 'averaged the two class means without weighting by class size', 'concept'],
      [Math.round(((n2 * a1 + n1 * a2) / (n1 + n2)) * 1e4) / 1e4, 'swapped the two class sizes', 'setup'],
      [total, 'added the total points and never divided by the number of students', 'quantity'],
    ],
    stem,
    expl: `The combined mean is total points over total students: $\\frac{${n1}\\times${a1}+${n2}\\times${a2}}{${n1 + n2}}=\\frac{${total}}{${n1 + n2}}=${num(ans)}$.`,
    desmos: `(${n1}*${a1}+${n2}*${a2})/(${n1}+${n2})`,
    note: 'A combined mean must be weighted by the size of each group.',
    check: `multiplied back: $${num(ans)}\\times${n1 + n2}=${total}$ total points`,
  };
}
reg({ fn: gWeightedAvg, domain: DATA_DOMAIN, skill: 'Weighted average', count: 10, spr: true });

/* ---- two-way tables: conditional probability (complete table) ---- */
const TWOWAY_CTX = [
  { intro: 'The table shows how the students in two grades get to school.', r1: 'Grade 9', r2: 'Grade 10', c1: 'Bus', c2: 'Walk', unit: 'student', v1: 'takes the bus', v2: 'walks', w1: 'is in Grade 9', w2: 'is in Grade 10' },
  { intro: 'The table shows the results of a trial of a new treatment.', r1: 'Treatment', r2: 'Control', c1: 'Improved', c2: 'No change', unit: 'patient', v1: 'received the treatment', v2: 'was in the control group', w1: 'improved', w2: 'showed no change' },
  { intro: 'The table shows what customers at a cafe ordered and how they paid.', r1: 'Coffee', r2: 'Tea', c1: 'Cash', c2: 'Card', unit: 'customer', v1: 'paid cash', v2: 'paid by card', w1: 'ordered coffee', w2: 'ordered tea' },
  { intro: 'The table shows the members of a gym by class time and experience level.', r1: 'Beginner', r2: 'Advanced', c1: 'Morning', c2: 'Evening', unit: 'member', v1: 'attends the morning class', v2: 'attends the evening class', w1: 'is a beginner', w2: 'is advanced' },
];

function gTwoWayConditional(r, L) {
  const c = r.pick(TWOWAY_CTX);
  let a = r.int(6, 16 + 2 * L);
  let b = r.int(5, 15 + 2 * L);
  let cc = r.int(4, 14 + 2 * L);
  let d = r.int(6, 16 + 2 * L);
  const T = a + b + cc + d;
  const table = pipeTable(
    ['', c.c1, c.c2, 'Total'],
    [
      [c.r1, a, b, a + b],
      [c.r2, cc, d, cc + d],
      ['Total', a + cc, b + d, T],
    ]
  );

  const kind = r.int(0, 3);
  let numr, den, given, asked;
  if (kind === 0) {
    numr = a; den = a + cc; given = c.v1; asked = c.w1;
  } else if (kind === 1) {
    numr = a; den = a + b; given = c.w1; asked = c.v1;
  } else if (kind === 2) {
    numr = d; den = b + d; given = c.v2; asked = c.w2;
  } else {
    numr = d; den = cc + d; given = c.w2; asked = c.v2;
  }
  const ans = numr / den;
  const stem = `${c.intro}\n\n${table}\n\nGiven that a randomly selected ${c.unit} ${given}, what is the probability that the ${c.unit} ${asked}?`;

  // independent re-read: locate the row/column totals straight from the table
  const checkDen = kind === 0 ? a + cc : kind === 1 ? a + b : kind === 2 ? b + d : cc + d;

  return {
    num: ans,
    text: frac(numr, den),
    spr: fracPlain(numr, den),
    alts: [
      [kind === 0 ? a / (a + b) : kind === 1 ? a / (a + cc) : kind === 2 ? d / (cc + d) : d / (b + d), 'used the row total instead of the column total (or the reverse) for the condition', 'setup'],
      [numr / T, 'divided by the grand total instead of by the group named in the condition', 'concept'],
      [(den - numr) / den, 'found the probability of the complement', 'misread'],
    ],
    stem,
    expl: `The condition restricts the group to the ${den} ${c.unit}s described, and ${numr} of them match the outcome asked about, so the probability is $${gcd(numr, den) === 1 ? frac(numr, den) : `\\frac{${numr}}{${den}}=${frac(numr, den)}`}$. Dividing by the group named in the condition, rather than the grand total, is what makes it conditional.`,
    desmos: `${numr}/${den}`,
    note: 'Conditional probability divides by the row or column total named after "given", not by the grand total.',
    check: `table sums to ${T}; denominator taken from the ${checkDen} group and numerator from the matching cell`,
  };
}
reg({ fn: gTwoWayConditional, domain: DATA_DOMAIN, skill: 'Two-way tables and conditional probability', count: 11, spr: true });

/* ---- two-way tables with a missing cell ---- */
function gTwoWayPartial(r, L) {
  const c = r.pick(TWOWAY_CTX);
  const a = r.int(7, 18 + 3 * L);
  const b = r.int(6, 17 + 3 * L);
  const cc = r.int(5, 15 + 3 * L);
  const d = r.int(8, 19 + 3 * L);
  const T = a + b + cc + d;
  const which = r.int(0, 3);
  const hide = [a, b, cc, d][which];
  const shown = (v) => (v === hide ? '?' : v);
  const table = pipeTable(
    ['', c.c1, c.c2, 'Total'],
    [
      [c.r1, shown(a), shown(b), a + b],
      [c.r2, shown(cc), shown(d), cc + d],
      ['Total', a + cc, b + d, T],
    ]
  );
  const rowLabel = which < 2 ? c.r1 : c.r2;
  const colLabel = which % 2 === 0 ? c.c1 : c.c2;
  const ans = hide;
  const stem = `${c.intro} Some of the counts are missing.\n\n${table}\n\nHow many ${c.unit}s are in the ${rowLabel} / ${colLabel} cell?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [which < 2 ? cc : a, 'read the other row (or column) from the same cell position', 'misread'],
      [which < 2 ? a + b : cc + d, 'gave the row total instead of the missing cell', 'quantity'],
      [hide + 1, 'arithmetic slip of one in the subtraction', 'arithmetic'],
    ],
    stem,
    expl: `The ${rowLabel} row must total ${which < 2 ? a + b : cc + d} and the ${colLabel} column must total ${which % 2 === 0 ? a + cc : b + d}. Solving either gives ${ans}, and both totals agree, which confirms the table is consistent.`,
    desmos: `${which < 2 ? a + b : cc + d}-${which < 2 ? (which === 0 ? b : a) : which === 2 ? d : cc}`,
    note: 'Either the row total or the column total determines a missing cell — both must agree.',
    check: `rebuilt the full table: rows ${a}+${b}=${a + b}, ${cc}+${d}=${cc + d}; columns ${a}+${cc}=${a + cc}, ${b}+${d}=${b + d}; grand total ${T}`,
  };
}
reg({ fn: gTwoWayPartial, domain: DATA_DOMAIN, skill: 'Two-way tables with partial information', count: 10, spr: true });

/* ---- simple probability ---- */
function gSimpleProb(r, L) {
  const red = r.int(3, 7 + L);
  const blue = r.int(3, 7 + L);
  const green = r.int(2, 6 + L);
  const T = red + blue + green;
  const kind = r.int(0, 2);
  if (kind === 0) {
    const stem = `A bag contains ${red} red marbles, ${blue} blue marbles, and ${green} green marbles. One marble is drawn at random. What is the probability that the marble is red?`;
    return {
      num: red / T,
      text: frac(red, T),
      spr: fracPlain(red, T),
      alts: [
        [blue / T, 'used the count of a different color', 'misread'],
        [red / (T - 1), 'reduced the denominator as if a marble had already been removed', 'concept'],
        [(T - red) / T, 'found the probability of not drawing red', 'misread'],
      ],
      stem,
      expl: `There are ${T} marbles in total and ${red} are red, so the probability is $\\frac{${red}}{${T}}=${frac(red, T)}$. Each marble is equally likely, so the denominator is always the total count.`,
      desmos: `${red}/${T}`,
      note: 'Probability is favorable outcomes over total outcomes.',
      check: `checked ${red}+${blue}+${green}=${T}`,
    };
  }
  if (kind === 1) {
    const stem = `A bag contains ${red} red marbles, ${blue} blue marbles, and ${green} green marbles. One marble is drawn at random. What is the probability that the marble is not blue?`;
    const ans = (T - blue) / T;
    return {
      num: ans,
      text: frac(T - blue, T),
      spr: fracPlain(T - blue, T),
      alts: [
        [blue / T, 'gave the probability of drawing blue instead of not blue', 'misread'],
        [(T - blue) / (T - 1), 'used the wrong denominator', 'concept'],
        [1 / T, 'used one outcome instead of all the non-blue outcomes', 'quantity'],
      ],
      stem,
      expl: `Of the ${T} marbles, $${T}-${blue}=${T - blue}$ are not blue, so the probability is $\\frac{${T - blue}}{${T}}=${frac(T - blue, T)}$.`,
      desmos: `(${T}-${blue})/${T}`,
      note: '"Not blue" counts every other marble, so the numerator is the sum of the other colors.',
      check: `checked $${red}+${green}=${T - blue}$ non-blue marbles`,
    };
  }
  const ans = (red / T) * ((red - 1) / (T - 1));
  const stem = `A bag contains ${red} red marbles, ${blue} blue marbles, and ${green} green marbles. Two marbles are drawn at random one after the other, without replacement. What is the probability that both marbles are red?`;
  return {
    num: ans,
    text: frac(red * (red - 1), T * (T - 1)),
    spr: fracPlain(red * (red - 1), T * (T - 1)),
    alts: [
      [(red / T) * (red / T), 'kept the first probability for the second draw, as if the marble were replaced', 'concept'],
      [(red - 1) / (T - 1), 'gave only the second draw', 'setup'],
      [(red / T) * ((blue) / (T - 1)), 'used the wrong number of favorable marbles on the second draw', 'arithmetic'],
    ],
    stem,
    expl: `The first marble is red with probability $\\frac{${red}}{${T}}$. After it is removed, ${red - 1} of the remaining ${T - 1} marbles are red, so the probability is $\\frac{${red}}{${T}}\\cdot\\frac{${red - 1}}{${T - 1}}=${frac(red * (red - 1), T * (T - 1))}$.`,
    desmos: `${red}/${T}*${red - 1}/${T - 1}`,
    note: 'Without replacement, both the favorable count and the total drop by one on the second draw.',
    check: `checked denominator $${T}\\times${T - 1}=${T * (T - 1)}$ and numerator $${red}\\times${red - 1}=${red * (red - 1)}$`,
  };
}
reg({ fn: gSimpleProb, domain: DATA_DOMAIN, skill: 'Simple probability', count: 10, spr: true });

/* ---- random sample validity ---- */
function gRandomSample(r, L) {
  const ctxs = [
    { intro: 'A school wants to know how students feel about moving the start of the school day.', pop: 'all students at the school', unit: 'students' },
    { intro: 'A gym wants to know which new classes its members would attend.', pop: 'the gym\'s full membership list', unit: 'members' },
    { intro: 'A town council wants to know whether residents support a new bus route.', pop: 'all registered voters in the town', unit: 'residents' },
    { intro: 'An online store wants to know how satisfied its customers are with delivery times.', pop: 'all customers who ordered in the last year', unit: 'customers' },
    { intro: 'A company wants to know whether employees support a four-day work week.', pop: 'all employees at the company', unit: 'employees' },
    { intro: 'A district wants to know how much homework students do each night.', pop: 'all students in the district', unit: 'students' },
  ];
  const c = r.pick(ctxs);
  const n = r.int(40, 240);
  const correct = `Select ${n} ${c.unit} at random from a list of ${c.pop}.`;
  const stem = `${c.intro} Which sampling method would produce the most representative sample?`;
  return {
    num: null,
    text: correct,
    alts: [
      [null, `Survey the first ${n} ${c.unit} who volunteer to respond.`, 'volunteers differ systematically from the population', 'concept'],
      [null, `Survey ${n} ${c.unit} who are easy to reach, such as friends of the researcher.`, 'a convenience sample over-represents one kind of person', 'setup'],
      [null, `Survey only the ${c.unit} who have already complained about the current arrangement.`, 'a sample built from complainers is biased toward one opinion', 'concept'],
    ],
    stem,
    expl: `A representative sample must give every member of the population a chance to be selected, so random selection from a list of ${c.pop} is the only unbiased method listed. The other three methods all over-represent one subgroup, so they cannot support a conclusion about the whole population.`,
    desmos: '',
    note: 'Random selection from the whole population is the only design that supports an inference to that population.',
    check: 'checked that exactly one option draws from the entire population at random; the rest are convenience or volunteer samples',
    onlyText: true,
  };
}
reg({ fn: gRandomSample, domain: DATA_DOMAIN, skill: 'Random sample validity', count: 9, spr: false });

/* ---- margin of error ---- */
function gMarginOfError(r, L) {
  const p = r.int(28, 62);
  const m = r.pick([2, 2.5, 3, 3.5, 4, 4.5, 5]);
  const n = r.pick([200, 400, 500, 800, 1000, 1200, 1500]);
  const kind = r.int(0, 2);
  if (kind === 0) {
    const ans = Math.round((p + m) * 1e6) / 1e6;
    const stem = `A poll of ${n} randomly selected voters found that ${pctTex(p)} support a ballot measure. The poll's margin of error is ${pctTex(m)} at the $95$ percent confidence level. What is the largest percent of all voters who could support the measure, according to this poll?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [p, 'gave the point estimate and ignored the margin of error', 'concept'],
        [Math.round((p + 2 * m) * 1e6) / 1e6, 'added twice the margin of error', 'setup'],
        [m, 'gave the margin of error itself', 'quantity'],
      ],
      stem,
      expl: `The plausible range is the point estimate plus or minus the margin of error, $${p}\\pm${num(m)}$, so the largest plausible percent is $${p}+${num(m)}=${num(ans)}$.`,
      desmos: `${p}+${num(m)}`,
      note: 'The margin of error is added to and subtracted from the point estimate, not multiplied.',
      check: `checked the interval $[${p - m},${p + m}]$ contains the estimate ${p}`,
    };
  }
  if (kind === 1) {
    const ans = Math.round((p - m) * 1e6) / 1e6;
    const stem = `A poll of ${n} randomly selected voters found that ${pctTex(p)} support a ballot measure, with a margin of error of ${pctTex(m)}. What is the smallest percent of all voters who could support the measure?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [p, 'gave the point estimate and ignored the margin of error', 'concept'],
        [Math.round((p - 2 * m) * 1e6) / 1e6, 'subtracted twice the margin of error', 'setup'],
        [Math.round((m) * 1e6) / 1e6, 'gave the margin of error itself', 'quantity'],
      ],
      stem,
      expl: `The lower end of the interval is $${p}-${num(m)}=${num(ans)}$ percent. Any percent outside the interval $[${p - m},${p + m}]$ is not supported by this poll.`,
      desmos: `${p}-${num(m)}`,
      note: 'The interval runs from estimate minus margin to estimate plus margin.',
      check: `checked $${p}-${num(m)}=${num(ans)}$ and that the estimate lies inside the interval`,
    };
  }
  const ans = Math.round(2 * m * 1e6) / 1e6;
  const stem = `A poll of ${n} randomly selected voters reported a margin of error of ${pctTex(m)}. What is the total width, in percentage points, of the interval of plausible values for the true percent?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [m, 'gave half the width of the interval', 'quantity'],
      [Math.round((p + m) * 1e6) / 1e6, 'added the margin of error to the estimate instead of doubling it', 'setup'],
      [Math.round((4 * m) * 1e6) / 1e6, 'doubled the margin of error twice', 'arithmetic'],
    ],
    stem,
    expl: `The interval is estimate $\\pm${num(m)}$, so it runs ${num(m)} points below and ${num(m)} points above the estimate, a total width of $${num(m)}+${num(m)}=${num(ans)}$ percentage points.`,
    desmos: `2*${num(m)}`,
    note: 'The margin of error is half the width of the interval.',
    check: `checked the interval $[${p - m},${p + m}]$ has width ${num(ans)}`,
  };
}
reg({ fn: gMarginOfError, domain: DATA_DOMAIN, skill: 'Margin of error', count: 10, spr: true });

/* ---- inference from samples ---- */
function gInferenceSample(r, L) {
  if (r.chance(0.6)) {
    const n = r.pick([25, 40, 50, 80, 100, 120, 200]);
    const k = r.int(Math.round(n * 0.2), Math.round(n * 0.7));
    const N = n * r.int(8, 30);
    const ans = Math.round(((k * N) / n) * 1e6) / 1e6;
    const pct = Math.round((k / n) * 1000) / 10;
    const stem = `A random sample of ${n} residents of a town was asked whether they favor a new park. Of those sampled, ${k} said yes. If the town has ${N} residents, which is the best estimate of the number of residents who favor the park?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [k, 'gave the number in the sample instead of scaling to the town', 'concept'],
        [Math.round((k / n) * 1e6) / 1e6, 'gave the sample proportion rather than a count of residents', 'quantity'],
        [Math.round((n / k) * N * 1e6) / 1e6, 'inverted the proportion', 'setup'],
      ],
      stem,
      expl: `The sample proportion is $\\frac{${k}}{${n}}=${num(Math.round((k / n) * 1e6) / 1e6)}$, so the best estimate for ${N} residents is $${N}\\times\\frac{${k}}{${n}}=${num(ans)}$. (This is ${num(pct)} percent of the town.)`,
      desmos: `${N}*${k}/${n}`,
      note: 'Scale the sample proportion up to the whole population; do not report the raw sample count.',
      check: `checked the proportion ${num(pct)} percent times ${N} residents reproduces ${num(ans)}`,
    };
  }
  const n = r.pick([10, 12, 15, 20, 25, 30, 40]);
  const mean = r.int(18, 45);
  const N = n * r.int(10, 40);
  const ans = mean * N;
  const stem = `A random sample of ${n} boxes from a warehouse has a mean weight of ${mean} pounds per box. The warehouse contains ${N} boxes. Which is the best estimate of the total weight of all the boxes in the warehouse?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [mean, 'gave the sample mean instead of a total', 'quantity'],
      [mean * n, 'scaled only to the sample size', 'setup'],
      [Math.round((N / mean) * 1e6) / 1e6, 'divided the number of boxes by the mean weight', 'concept'],
    ],
    stem,
    expl: `Multiply the sample mean by the number of boxes in the warehouse: $${mean}\\times${N}=${num(ans)}$ pounds. The sample was random, so its mean is the best available estimate of the population mean.`,
    desmos: `${mean}*${N}`,
    note: 'A sample mean estimates the population mean; the total is that mean times the population size.',
    check: `divided back: $${num(ans)}\\div${N}=${mean}$ pounds per box`,
  };
}
reg({ fn: gInferenceSample, domain: DATA_DOMAIN, skill: 'Inference from samples', count: 10, spr: true });

/* ---- scatterplot: slope in context ---- */
const SCATTER_CTX = [
  { xLabel: 'hours studied', yLabel: 'test score', yUnit: 'points', xUnit: 'hour', xUnits: 'hours', xPhrase: 'the number of hours studied', a: 62, b: 4.5 },
  { xLabel: 'years of experience', yLabel: 'hourly wage', yUnit: 'dollars', xUnit: 'year', xUnits: 'years', xPhrase: 'the number of years of experience', a: 14, b: 1.25 },
  { xLabel: 'ounces of fertilizer', yLabel: 'plant height', yUnit: 'centimeters', xUnit: 'ounce', xUnits: 'ounces', xPhrase: 'the amount of fertilizer', a: 8, b: 2.4 },
  { xLabel: 'weeks of training', yLabel: 'sprint time', yUnit: 'seconds', xUnit: 'week', xUnits: 'weeks', xPhrase: 'the number of weeks of training', a: 14.2, b: -0.3 },
  { xLabel: 'advertising spend', yLabel: 'weekly sales', yUnit: 'dollars', xUnit: 'thousand dollars', xUnits: 'thousand dollars', xPhrase: 'the advertising spend', a: 30, b: 2.5 },
];

function linTex(a, b) {
  const bb = num(Math.abs(b));
  return `$y=${num(a)}${b < 0 ? '-' : '+'}${bb}x$`;
}

function gScatterSlope(r, L) {
  const c = r.pick(SCATTER_CTX);
  const base = c.a;
  const slope = Math.round((c.b + (r.int(-2, 2) * 0.1)) * 100) / 100;
  const k = r.int(2, 3 + L);
  const ans = Math.round(slope * k * 1e6) / 1e6;
  const stem = `A line of best fit for a scatterplot of ${c.xLabel} and ${c.yLabel} is ${linTex(base, slope)}.\n\nAccording to the model, how much does the predicted ${c.yLabel} change when ${c.xPhrase} increases by ${k} ${c.xUnits}?`;
  const dir = slope < 0 ? 'decreases' : 'increases';
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [base, 'gave the intercept instead of the change', 'concept'],
      [Math.round(slope * 1e6) / 1e6, 'gave the change for one unit rather than for the stated number of units', 'misread'],
      [Math.round((base + slope * k) * 1e6) / 1e6, 'gave the predicted value, not the change in it', 'quantity'],
    ],
    stem,
    expl: `Each additional ${c.xUnit} changes the prediction by ${num(slope)} ${c.yUnit}, so ${k} ${c.xUnits} change it by $${k}\\times${num(slope)}=${num(ans)}$. The prediction ${dir} by ${num(Math.abs(ans))} ${c.yUnit}.`,
    desmos: `y=${num(base)}${slope < 0 ? '-' : '+'}${num(Math.abs(slope))}x`,
    note: 'The slope is the change per one unit; multiply it by the number of units asked about.',
    check: `evaluated the model at $x=${k}$ and at $x=0$: difference $=${num(ans)}$`,
  };
}
reg({ fn: gScatterSlope, domain: DATA_DOMAIN, skill: 'Scatterplots and lines of best fit (slope)', count: 10, spr: true });

/* ---- scatterplot: intercept in context ---- */
function gScatterIntercept(r, L) {
  const c = r.pick(SCATTER_CTX);
  const slope = Math.round((c.b + r.int(-2, 2) * 0.1) * 100) / 100;
  const x1 = r.int(2, 6);
  const y1 = Math.round((c.a + slope * x1) * 100) / 100;
  const x2 = x1 + r.int(2, 4);
  const y2 = Math.round((c.a + slope * x2) * 100) / 100;
  const ans = Math.round((y1 - slope * x1) * 100) / 100;
  const stem = `A line of best fit models ${c.yLabel} as a linear function of ${c.xLabel}. The model predicts ${num(y1)} ${c.yUnit} when ${c.xPhrase} is ${x1} ${c.xUnits}, and ${num(y2)} ${c.yUnit} when ${c.xPhrase} is ${x2} ${c.xUnits}. What is the predicted ${c.yLabel} when ${c.xPhrase} is $0$ ${c.xUnits}?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [Math.round(slope * 1e6) / 1e6, 'gave the slope of the model', 'concept'],
      [y1, 'gave the prediction at the first data point', 'misread'],
      [Math.round((y2 - y1) * 1e6) / 1e6, 'gave the change between the two predictions', 'quantity'],
    ],
    stem,
    expl: `The slope is $\\frac{${num(y2)}-${num(y1)}}{${x2}-${x1}}=${num(slope)}$. Using the first point, $${num(y1)}=a+${num(slope)}\\times${x1}$, so $a=${num(ans)}$. The intercept is the model's prediction when the explanatory variable is zero.`,
    desmos: `${num(y1)}-${num(slope)}*${x1}`,
    note: 'The intercept is the prediction at $x=0$, found by backing the slope out of a known point.',
    check: `reconstructed $${num(slope)}\\times${x1}+${num(ans)}=${num(y1)}$ and $${num(slope)}\\times${x2}+${num(ans)}=${num(y2)}$`,
  };
}
reg({ fn: gScatterIntercept, domain: DATA_DOMAIN, skill: 'Scatterplots and lines of best fit (intercept)', count: 9, spr: true });

/* ---- predicted value from a line of best fit ---- */
function gScatterPredict(r, L) {
  const c = r.pick(SCATTER_CTX);
  const slope = Math.round((c.b + r.int(-2, 2) * 0.1) * 100) / 100;
  const base = c.a;
  const x = r.int(3, 8 + 2 * L);
  const ans = Math.round((base + slope * x) * 100) / 100;
  const stem = `A line of best fit for a scatterplot of ${c.xLabel} and ${c.yLabel} is ${linTex(base, slope)}.\n\nWhat ${c.yLabel} does the model predict when ${c.xPhrase} is ${x} ${c.xUnits}?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [Math.round((base * x + slope) * 100) / 100, 'multiplied the intercept by $x$ and added the slope', 'setup'],
      [Math.round((base + slope / x) * 100) / 100, 'divided the slope by $x$ instead of multiplying', 'algebra'],
      [base, 'gave the intercept, ignoring $x$', 'concept'],
    ],
    stem,
    expl: `Substitute $x=${x}$: $y=${num(base)}${slope < 0 ? '-' : '+'}${num(Math.abs(slope))}\\times${x}=${num(ans)}$. A line of best fit predicts by substituting into the equation, not by reading a data point.`,
    desmos: `y=${num(base)}${slope < 0 ? '-' : '+'}${num(Math.abs(slope))}x`,
    note: 'A predicted value always comes from substituting into the model.',
    check: `evaluated in two steps: $${num(slope)}\\times${x}=${num(Math.round(slope * x * 1e6) / 1e6)}$ then added ${num(base)}`,
  };
}
reg({ fn: gScatterPredict, domain: DATA_DOMAIN, skill: 'Predicted value from a line of best fit', count: 10, spr: true });

/* ---- density ---- */
function gDensity(r, L) {
  const d = r.pick([2.5, 3, 4, 5, 7.5, 8, 0.5, 1.5, 2, 6]);
  const v = r.int(4, 12 + 3 * L);
  const m = Math.round(d * v * 1e6) / 1e6;
  const kind = r.int(0, 1);
  if (kind === 0) {
    const stem = `A block of metal has a volume of ${v} cubic centimeters and a density of ${num(d)} grams per cubic centimeter. What is the mass of the block, in grams?`;
    return {
      num: m,
      text: num(m),
      spr: num(m),
      alts: [
        [Math.round((v / d) * 1e6) / 1e6, 'divided volume by density instead of multiplying', 'concept'],
        [v + d, 'added density and volume', 'setup'],
        [Math.round((d / v) * 1e6) / 1e6, 'divided density by volume', 'concept'],
      ],
      stem,
      expl: `Density is mass per unit volume, so mass is density times volume: $${num(d)}\\times${v}=${num(m)}$ grams. The units confirm the operation, since grams per cubic centimeter times cubic centimeters leaves grams.`,
      desmos: `${num(d)}*${v}`,
      note: 'g/cm$^3$ times cm$^3$ leaves grams — the units confirm the multiplication.',
      check: `divided back: $${num(m)}\\div${v}=${num(d)}$ g/cm$^3$`,
    };
  }
  const stem = `A sample of a liquid has a mass of ${num(m)} grams and a density of ${num(d)} grams per milliliter. What is the volume of the sample, in milliliters?`;
  return {
    num: v,
    text: num(v),
    spr: num(v),
    alts: [
      [Math.round(m * d * 1e6) / 1e6, 'multiplied mass by density instead of dividing', 'concept'],
      [Math.round((m - d) * 1e6) / 1e6, 'subtracted the density from the mass', 'setup'],
      [Math.round((d / m) * 1e6) / 1e6, 'divided density by mass', 'concept'],
    ],
    stem,
    expl: `Volume is mass divided by density: $${num(m)}\\div${num(d)}=${v}$ milliliters. Density fixes how much volume each gram occupies, so dividing by it converts mass into volume.`,
    desmos: `${num(m)}/${num(d)}`,
    note: 'When the unknown is volume, density goes in the denominator.',
    check: `multiplied back: $${v}\\times${num(d)}=${num(m)}$ grams`,
  };
}
reg({ fn: gDensity, domain: DATA_DOMAIN, skill: 'Density', count: 10, spr: true });

/* ---- rate / work ---- */
const WORK_PAIRS = [[6, 12], [4, 12], [5, 20], [10, 15], [8, 24], [9, 18], [20, 30], [15, 10], [12, 6], [3, 6], [2, 6], [12, 24], [30, 20], [18, 9]];

function gRateWork(r, L) {
  const [a, b] = r.pick(WORK_PAIRS);
  const t = Math.round(((a * b) / (a + b)) * 1e6) / 1e6;
  const stem = `One crew can pave a road in ${a} days, and a second crew can pave the same road in ${b} days. Working together at these constant rates, how many days will the two crews take to pave the road?`;
  return {
    num: t,
    text: num(t),
    spr: num(t),
    alts: [
      [Math.round(((a + b) / 2) * 1e6) / 1e6, 'averaged the two times instead of adding the rates', 'concept'],
      [Math.min(a, b), 'used the faster crew alone', 'setup'],
      [Math.round((a * b) / Math.abs(b - a) * 1e6) / 1e6, 'used the difference of the times instead of the sum of the rates', 'setup'],
    ],
    stem,
    expl: `The rates are $\\frac{1}{${a}}$ and $\\frac{1}{${b}}$ of the road per day. Together they pave $\\frac{1}{${a}}+\\frac{1}{${b}}=${frac(a + b, a * b)}$ of the road per day, so the job takes $${frac(a * b, a + b)}$ days. Working together is always faster than either crew alone.`,
    desmos: `1/(1/${a}+1/${b})`,
    note: 'Rates add; times do not. Averaging the two times always overstates the combined time.',
    check: `checked combined rate $\\frac{${a + b}}{${a * b}}$ times $${num(t)}$ equals $1$ job`,
  };
}
reg({ fn: gRateWork, domain: DATA_DOMAIN, skill: 'Rate and work problems', count: 10, spr: true });

/* ---- distance-rate-time with two travellers ---- */
function gDrtTwo(r, L) {
  const toward = r.chance(0.6);
  const r1 = r.int(30, 55);
  const r2 = toward ? r.int(35, 70) : r1 + r.int(8, 25);
  const t = r.int(2, 5 + L);
  if (toward) {
    const d = (r1 + r2) * t;
    const stem = `Two trains are ${d} miles apart and start moving toward each other at the same time on parallel tracks. One travels at ${r1} miles per hour and the other at ${r2} miles per hour. In how many hours will the two trains meet?`;
    return {
      num: t,
      text: num(t),
      spr: num(t),
      alts: [
        [Math.round((d / Math.abs(r2 - r1)) * 1e6) / 1e6, 'divided by the difference of the speeds instead of the sum', 'setup'],
        [Math.round((d / r1) * 1e6) / 1e6, 'used only the first train\'s speed', 'concept'],
        [Math.round((d / (r1 + r2)) * 2 * 1e6) / 1e6, 'doubled the correct time', 'arithmetic'],
      ],
      stem,
      expl: `Moving toward each other, the trains close the gap at $${r1}+${r2}=${r1 + r2}$ miles per hour, so they meet after $${d}\\div${r1 + r2}=${t}$ hours.`,
      desmos: `${d}/(${r1}+${r2})`,
      note: 'Approaching travellers add their speeds; the gap shrinks at the combined rate.',
      check: `checked each train covers $${r1 * t}$ and $${r2 * t}$ miles, which sum to ${d}`,
    };
  }
  const lead = (r2 - r1) * t;
  const stem = `A freight train leaves a station travelling at ${r1} miles per hour. ${t} hours later, an express train leaves the same station on a parallel track travelling at ${r2} miles per hour in the same direction. How many hours after the express train leaves will it catch the freight train?`;
  return {
    num: t,
    text: num(t),
    spr: num(t),
    alts: [
      [Math.round((lead / (r1 + r2)) * 1e6) / 1e6, 'divided by the sum of the speeds instead of the difference', 'setup'],
      [Math.round((lead / r2) * 1e6) / 1e6, 'used the express train\'s speed as the closing speed', 'concept'],
      [Math.round((lead / (r2 - r1)) * 0.5 * 1e6) / 1e6, 'halved the correct time', 'arithmetic'],
    ],
    stem,
    expl: `By the time the express leaves, the freight train is $${r1}\\times${t}=${lead}$ miles ahead. The express closes at $${r2}-${r1}=${r2 - r1}$ miles per hour, so it catches up in $${lead}\\div${r2 - r1}=${t}$ hours.`,
    desmos: `${lead}/(${r2}-${r1})`,
    note: 'A chase uses the difference of the speeds; a head-on approach uses the sum.',
    check: `checked the freight train travels $${r1}\\times${2 * t}$ miles while the express travels $${r2 * t}$, a gap of ${lead} at the start`,
  };
}
reg({ fn: gDrtTwo, domain: DATA_DOMAIN, skill: 'Distance, rate, and time with two travellers', count: 10, spr: true });

/* ---- mixture / concentration ---- */
function gMixture(r, L) {
  const V = r.pick([20, 30, 40, 50, 60, 80, 100, 120]);
  const p = r.pick([10, 15, 20, 25, 30, 40, 50]);
  const w = r.pick([10, 15, 20, 25, 30, 40, 50, 60]);
  const q = r.pick([0, 0, 5, 10, 50, 60, 70, 100]);
  const solute = Math.round(((V * p) / 100 + (w * q) / 100) * 1e6) / 1e6;
  const total = V + w;
  const ans = Math.round((solute / total) * 100 * 1e6) / 1e6;
  const qLabel = q === 0 ? 'pure water' : q === 100 ? 'pure acid' : `a ${q} percent acid solution`;
  const stem = `A chemist mixes ${V} liters of a ${p} percent acid solution with ${w} liters of ${qLabel}. What is the acid concentration, as a percent, of the resulting mixture?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [Math.round(((p + q) / 2) * 1e6) / 1e6, 'averaged the two concentrations without weighting by volume', 'concept'],
      [p, 'assumed the concentration does not change', 'misread'],
      [Math.round((solute / V) * 100 * 1e6) / 1e6, 'divided by the original volume instead of the new total volume', 'setup'],
    ],
    stem,
    expl: `The acid amounts are $${V}\\times${num(p / 100)}=${num(Math.round((V * p) / 100 * 1e6) / 1e6)}$ and $${w}\\times${num(q / 100)}=${num(Math.round((w * q) / 100 * 1e6) / 1e6)}$ liters. Over a total of ${total} liters that is $${num(Math.round(solute * 1e6) / 1e6)}\\div${total}\\times100=${num(ans)}$ percent.`,
    desmos: `(${V}*${num(p / 100)}+${w}*${num(q / 100)})/(${total})*100`,
    note: 'Only the amount of solute adds; the denominator is the new total volume.',
    check: `checked acid total $${num(Math.round(solute * 1e6) / 1e6)}$ L and new volume $${V}+${w}=${total}$ L`,
  };
}
reg({ fn: gMixture, domain: DATA_DOMAIN, skill: 'Mixture and concentration', count: 10, spr: true });

/* ================================================================== *
 * 7. GEOMETRY AND TRIGONOMETRY
 * ================================================================== */

/* ---- parallel lines and a transversal ---- */
function gParallelAngles(r, L) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x0 = r.int(3, 9 + 2 * L);
    const a = r.int(2, 5);
    const c = r.int(4, 26);
    const angle = a * x0 + c;
    if (angle < 30 || angle > 150) continue;
    let b = r.int(2, 5);
    if (b === a) b = a === 5 ? 3 : a + 1;
    const supp = r.chance(0.45);
    const d = (supp ? 180 - angle : angle) - b * x0;
    if (d < 3) continue;

    const eq = supp
      ? `(${a}x+${c})+(${b}x+${d})=180`
      : `(${a}x+${c})=(${b}x+${d})`;
    const alts = [];
    if (supp) {
      const v = (d - c) / (a - b);
      if (Number.isFinite(v) && v > 0 && v !== x0) alts.push([Math.round(v * 1e6) / 1e6, 'set the two expressions equal even though same-side interior angles are supplementary', 'concept']);
    } else {
      const v = (180 - c - d) / (a + b);
      if (v > 0 && v !== x0) alts.push([Math.round(v * 1e6) / 1e6, 'added the two expressions and set them equal to $180$ even though the angles are equal', 'concept']);
    }
    alts.push([x0 + 2, 'arithmetic slip while solving the equation', 'arithmetic']);
    alts.push([Math.round(((c + d) / (a + b)) * 1e6) / 1e6, 'divided the constant terms by the sum of the coefficients', 'algebra']);

    return {
      num: x0,
      text: num(x0),
      spr: num(x0),
      alts,
      stem: `Lines $\\ell$ and $m$ are parallel, and a transversal intersects both lines. One angle formed measures $(${a}x+${c})^\\circ$ and a second angle measures $(${b}x+${d})^\\circ$. The two angles are ${supp ? 'same-side interior angles' : 'alternate interior angles'}. What is the value of $x$?`,
      expl: `${supp ? 'Same-side interior angles are supplementary' : 'Alternate interior angles are equal'}, so $${eq}$. Solving gives $x=${x0}$, which makes both angles measure $${angle}^\\circ$.`,
      desmos: eq.replace(/=/g, '='),
      note: supp
        ? 'Same-side (consecutive) interior angles add to $180^\\circ$; alternate interior angles are equal.'
        : 'Alternate interior angles are equal — do not add them to $180^\\circ$.',
      check: `substituted $x=${x0}$: angles $${angle}^\\circ$ and $${b * x0 + d}^\\circ$, whose ${supp ? 'sum is 180' : 'measures match'}`,
    };
  }
  return null;
}
reg({ fn: gParallelAngles, domain: GEO_DOMAIN, skill: 'Angles and parallel lines', count: 9, spr: true });

/* ---- triangle angle sum ---- */
function gTriangleSum(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const triples = [[1, 2, 3], [2, 3, 4], [1, 1, 2], [3, 4, 5], [2, 2, 5], [1, 3, 5], [4, 5, 9], [2, 3, 5], [1, 2, 6], [3, 5, 7]];
    const t = r.pick(triples);
    const sum = t[0] + t[1] + t[2];
    const unit = 180 / sum;
    const largest = Math.max(...t) * unit;
    const stem = `The measures of the three angles of a triangle are in the ratio $${t[0]}:${t[1]}:${t[2]}$. What is the measure, in degrees, of the largest angle?`;
    return {
      num: largest,
      text: num(largest),
      spr: num(largest),
      alts: [
        [Math.round((180 - largest) * 1e6) / 1e6, 'found the sum of the other two angles', 'misread'],
        [Math.max(...t), 'used the ratio number itself as an angle measure', 'concept'],
        [Math.round((largest * 2) * 1e6) / 1e6, 'doubled the largest angle', 'arithmetic'],
      ],
      stem,
      expl: `The ratio has $${sum}$ equal parts, and the angles total $180^\\circ$, so one part is $${num(unit)}^\\circ$. The largest angle is $${Math.max(...t)}\\times${num(unit)}=${num(largest)}^\\circ$.`,
      desmos: `180/(${sum})*${Math.max(...t)}`,
      note: 'A ratio partitions $180^\\circ$; the ratio numbers are not the angle measures.',
      check: `checked all three angles: $${num(t[0] * unit)}+${num(t[1] * unit)}+${num(t[2] * unit)}=180$`,
    };
  }
  if (kind === 1) {
    const A = r.int(30, 80);
    let B = r.int(25, 85);
    if (A + B > 165) B = 165 - A;
    const C = 180 - A - B;
    const stem = `Two angles of a triangle measure $${A}^\\circ$ and $${B}^\\circ$. What is the measure, in degrees, of the third angle?`;
    return {
      num: C,
      text: num(C),
      spr: num(C),
      alts: [
        [A + B, 'gave the sum of the two known angles instead of the remaining angle', 'concept'],
        [Math.round((360 - A - B) * 1e6) / 1e6, 'used $360^\\circ$ instead of $180^\\circ$', 'concept'],
        [Math.abs(A - B), 'subtracted the angles instead of adding them', 'sign'],
      ],
      stem,
      expl: `The three angles sum to $180^\\circ$, so the third angle is $180-${A}-${B}=${C}$ degrees. Every triangle has this same angle sum, whatever its shape.`,
      desmos: `180-${A}-${B}`,
      note: 'Triangle angle sum is $180^\\circ$, not $360^\\circ$.',
      check: `checked $${A}+${B}+${C}=180$`,
    };
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const x0 = r.int(6, 14 + L);
    const a = r.int(2, 4);
    const c = r.int(5, 20);
    const b = r.int(1, 3);
    const e = r.int(5, 25);
    const T = 180 - (a + b) * x0 - c - e;
    if (T < 25 || T > 110) continue;
    return {
      num: x0,
      text: num(x0),
      spr: num(x0),
      alts: [
        [Math.round(((180 - c - e) / (a + b)) * 1e6) / 1e6, 'forgot to subtract the fixed angle before dividing', 'setup'],
        [x0 + 2, 'arithmetic slip while solving', 'arithmetic'],
        [Math.round(((180 + c + e) / (a + b)) * 1e6) / 1e6, 'added the constants instead of subtracting them', 'sign'],
      ],
      stem: `In triangle $ABC$, $\\angle A=(${a}x+${c})^\\circ$, $\\angle B=(${b}x+${e})^\\circ$, and $\\angle C=${T}^\\circ$. What is the value of $x$?`,
      expl: `The angles sum to $180^\\circ$: $(${a}x+${c})+(${b}x+${e})+${T}=180$, so $${a + b}x+${c + e + T}=180$. Thus $${a + b}x=${180 - c - e - T}$ and $x=${x0}$.`,
      desmos: `(${a}+${b})x+${c + e}+${T}=180`,
      note: 'Every angle of the triangle must appear in the sum, including the one given as a plain number.',
      check: `substituted $x=${x0}$: $${a * x0 + c}+${b * x0 + e}+${T}=180$`,
    };
  }
  return null;
}
reg({ fn: gTriangleSum, domain: GEO_DOMAIN, skill: 'Triangle angle sum', count: 9, spr: true });

/* ---- isosceles triangles ---- */
function gIsosceles(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const v = r.pick([20, 30, 40, 50, 60, 70, 80, 100, 110, 120]);
    const base = (180 - v) / 2;
    const stem = `In isosceles triangle $ABC$, $AB=AC$ and the vertex angle at $A$ measures $${v}^\\circ$. What is the measure of $\\angle B$?`;
    return {
      num: base,
      text: num(base),
      spr: num(base),
      alts: [
        [180 - v, 'found the sum of the two base angles but did not split it', 'setup'],
        [v, 'assumed the base angles equal the vertex angle', 'concept'],
        [Math.round(v / 2 * 1e6) / 1e6, 'took half the vertex angle as a base angle', 'concept'],
      ],
      stem,
      expl: `The base angles are equal and the angles sum to $180^\\circ$, so $2\\angle B+${v}=180$. Then $2\\angle B=${180 - v}$ and $\\angle B=${base}$.`,
      desmos: `(180-${v})/2`,
      note: 'The remaining angle after the vertex angle must be split evenly between the two base angles.',
      check: `checked $${v}+${base}+${base}=180$`,
    };
  }
  if (kind === 1) {
    const base = r.int(30, 80);
    const v = 180 - 2 * base;
    const stem = `In isosceles triangle $ABC$, $AB=AC$ and each base angle measures $${base}^\\circ$. What is the measure of the vertex angle at $A$?`;
    return {
      num: v,
      text: num(v),
      spr: num(v),
      alts: [
        [180 - base, 'subtracted only one base angle', 'setup'],
        [base, 'assumed the vertex angle equals a base angle', 'concept'],
        [Math.round((2 * base) * 1e6) / 1e6, 'gave the sum of the two base angles', 'misread'],
      ],
      stem,
      expl: `The two base angles total $${2 * base}^\\circ$, so the vertex angle is $180-${2 * base}=${v}$ degrees. The base angles are equal because the sides opposite them are equal.`,
      desmos: `180-2*${base}`,
      note: 'Both base angles are equal, so subtract twice the base angle from $180$.',
      check: `checked $${v}+${base}+${base}=180$`,
    };
  }
  const t = r.pick([1, 2, 3, 4, 7, 8]);
  const base = 180 / (t + 2);
  const v = t * base;
  const stem = `In isosceles triangle $ABC$, $AB=AC$ and the vertex angle at $A$ is ${t} times the measure of each base angle. What is the measure of $\\angle B$?`;
  return {
    num: base,
    text: num(base),
    spr: num(base),
    alts: [
      [Math.round(v * 1e6) / 1e6, 'gave the vertex angle instead of a base angle', 'misread'],
      [Math.round((180 / (t + 1)) * 1e6) / 1e6, 'counted only one base angle when setting up the equation', 'setup'],
      [Math.round((base / 2) * 1e6) / 1e6, 'halved the base angle', 'arithmetic'],
    ],
    stem,
    expl: `Let each base angle be $b$. Then the vertex angle is $${t}b$, and $${t}b+2b=180$, so $${t + 2}b=180$ and $b=${base}$.`,
    desmos: `180/(${t}+2)`,
    note: 'There are two equal base angles, so the equation has $b+b$ plus the vertex angle.',
    check: `checked $${v}+${base}+${base}=180$ with vertex $=${t}\\times${base}$`,
  };
}
reg({ fn: gIsosceles, domain: GEO_DOMAIN, skill: 'Isosceles triangles', count: 9, spr: true });

/* ---- exterior angle ---- */
function gExteriorAngle(r, L) {
  const r1 = r.int(35, 80);
  let r2 = r.int(30, 75);
  if (r1 + r2 > 165) r2 = 160 - r1;
  const ext = r1 + r2;
  const kind = r.int(0, 1);
  if (kind === 0) {
    const stem = `In triangle $ABC$, the exterior angle at vertex $C$ is formed by extending side $BC$. The two remote interior angles measure $${r1}^\\circ$ and $${r2}^\\circ$. What is the measure, in degrees, of the exterior angle at $C$?`;
    return {
      num: ext,
      text: num(ext),
      spr: num(ext),
      alts: [
        [180 - ext, 'gave the interior angle at $C$ instead of the exterior angle', 'misread'],
        [Math.abs(r1 - r2), 'subtracted the remote interior angles', 'sign'],
        [180 - r1, 'used $180$ minus one remote angle', 'concept'],
      ],
      stem,
      expl: `An exterior angle equals the sum of the two remote interior angles: $${r1}+${r2}=${ext}$ degrees. Equivalently, it is $180^\\circ$ minus the adjacent interior angle.`,
      desmos: `${r1}+${r2}`,
      note: 'The exterior angle equals the sum of the two angles it is not adjacent to.',
      check: `checked the interior angle at $C$ is $${180 - ext}$, and $${r1}+${r2}+${180 - ext}=180$`,
    };
  }
  const other = ext - r1;
  const stem = `In triangle $ABC$, the exterior angle at $C$ measures $${ext}^\\circ$. One remote interior angle measures $${r1}^\\circ$. What is the measure, in degrees, of the other remote interior angle?`;
  return {
    num: other,
    text: num(other),
    spr: num(other),
    alts: [
      [ext, 'gave the exterior angle again', 'misread'],
      [180 - ext, 'gave the interior angle at $C$', 'concept'],
      [Math.round((r1 + ext) * 1e6) / 1e6, 'added instead of subtracting', 'sign'],
    ],
    stem,
    expl: `The exterior angle equals the sum of the two remote interior angles, so the missing one is $${ext}-${r1}=${other}$ degrees.`,
    desmos: `${ext}-${r1}`,
    note: 'Subtract the known remote angle from the exterior angle.',
    check: `checked $${r1}+${other}=${ext}$ and interior angle $${180 - ext}$`,
  };
}
reg({ fn: gExteriorAngle, domain: GEO_DOMAIN, skill: 'Exterior angle of a triangle', count: 8, spr: true });

/* ---- similar triangles: proportional sides ---- */
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [6, 8, 10], [12, 16, 20], [10, 24, 26], [15, 20, 25], [5, 12, 13], [8, 15, 17]];

function gSimilarSides(r, L) {
  const tri = r.pick(TRIPLES);
  const k = r.pick(L >= 2 ? [2, 3, 4, 0.5, 1.5, 2.5] : [2, 3, 0.5, 1.5]);
  const sides = tri.map((s) => Math.round(s * k * 1e6) / 1e6);
  const stem = `Triangle $ABC$ is similar to triangle $DEF$, where $A$ corresponds to $D$, $B$ to $E$, and $C$ to $F$. If $AB=${tri[0]}$, $BC=${tri[1]}$, and $DE=${num(sides[0])}$, what is the length of $EF$?`;
  return {
    num: sides[1],
    text: num(sides[1]),
    spr: num(sides[1]),
    alts: [
      [Math.round((tri[1] + (sides[0] - tri[0])) * 1e6) / 1e6, 'added the difference of the corresponding sides instead of scaling', 'concept'],
      [Math.round((tri[1] / (sides[0] / tri[0])) * 1e6) / 1e6, 'inverted the scale factor', 'setup'],
      [sides[0], 'gave the corresponding side $DE$ instead of $EF$', 'misread'],
    ],
    stem,
    expl: `The scale factor from $ABC$ to $DEF$ is $\\frac{${num(sides[0])}}{${tri[0]}}=${num(Math.round((sides[0] / tri[0]) * 1e6) / 1e6)}$, so $EF=${tri[1]}\\times${num(Math.round((sides[0] / tri[0]) * 1e6) / 1e6)}=${num(sides[1])}$. Corresponding sides of similar triangles are all in that same ratio.`,
    desmos: `${tri[1]}*${num(sides[0])}/${tri[0]}`,
    note: 'Similar figures scale every corresponding side by the same factor — they do not add a constant.',
    check: `checked all three sides scale by the same factor: $${tri[0]}\\to${num(sides[0])}$, $${tri[1]}\\to${num(sides[1])}$, $${tri[2]}\\to${num(sides[2])}$`,
  };
}
reg({ fn: gSimilarSides, domain: GEO_DOMAIN, skill: 'Similar triangles and proportional sides', count: 9, spr: true });

/* ---- similar triangles: word problems ---- */
function gSimilarWord(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const h = r.int(4, 9);
    const s = r.int(3, 7);
    const k = r.int(3, 6 + L);
    const S = s * k;
    const H = h * k;
    const stem = `A vertical post ${h} feet tall casts a shadow ${s} feet long at the same time that a nearby building casts a shadow ${S} feet long. Both shadows are measured at the same time of day. How tall is the building, in feet?`;
    return {
      num: H,
      text: num(H),
      spr: num(H),
      alts: [
        [Math.round((h + (S - s)) * 1e6) / 1e6, 'added the difference in shadow lengths instead of scaling', 'concept'],
        [Math.round((h * s) / S * 1e6) / 1e6, 'inverted the proportion', 'setup'],
        [S, 'assumed the building is as tall as its shadow is long', 'setup'],
      ],
      stem,
      expl: `The triangles formed by each object and its shadow are similar, so $\\frac{${h}}{${s}}=\\frac{H}{${S}}$. Thus $H=${h}\\times\\frac{${S}}{${s}}=${H}$ feet.`,
      desmos: `${h}*${S}/${s}`,
      note: 'Height over shadow is the same ratio for both objects at the same time of day.',
      check: `checked $\\frac{${h}}{${s}}=\\frac{${H}}{${S}}=${num(Math.round((h / s) * 1e6) / 1e6)}$`,
    };
  }
  if (kind === 1) {
    const cm = r.int(2, 5);
    const km = r.int(3, 9 + L);
    const mapCm = r.int(3, 6);
    const ans = (mapCm / cm) * km;
    const stem = `On a map, ${cm} centimeters represents ${km} kilometers of actual distance. Two towns are ${mapCm} centimeters apart on the map. What is the actual distance between the towns, in kilometers?`;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [Math.round((km / cm) * 1e6) / 1e6, 'gave the distance represented by one centimeter', 'quantity'],
        [Math.round((mapCm * cm / km) * 1e6) / 1e6, 'inverted the scale', 'setup'],
        [mapCm + km, 'added the map distance to the scale', 'concept'],
      ],
      stem,
      expl: `Each centimeter represents $\\frac{${km}}{${cm}}=${num(Math.round((km / cm) * 1e6) / 1e6)}$ kilometers, so ${mapCm} centimeters represents $${mapCm}\\times\\frac{${km}}{${cm}}=${num(ans)}$ kilometers.`,
      desmos: `${mapCm}*${km}/${cm}`,
      note: 'Scale drawings are proportional: map distance over actual distance is constant.',
      check: `checked $\\frac{${mapCm}}{${num(ans)}}=\\frac{${cm}}{${km}}$`,
    };
  }
  const tri = r.pick(TRIPLES);
  const k = r.int(2, 4);
  const stem = `A triangular garden has sides of length ${tri[0]} meters, ${tri[1]} meters, and ${tri[2]} meters. A similar triangular garden is built with its shortest side measuring ${tri[0] * k} meters. What is the perimeter of the larger garden, in meters?`;
  const per = (tri[0] + tri[1] + tri[2]) * k;
  return {
    num: per,
    text: num(per),
    spr: num(per),
    alts: [
      [tri[0] + tri[1] + tri[2], 'gave the perimeter of the smaller garden', 'misread'],
      [Math.round((tri[0] + tri[1] + tri[2] + (tri[0] * k - tri[0])) * 1e6) / 1e6, 'added the change in one side to the perimeter', 'concept'],
      [Math.round((per * k) * 1e6) / 1e6, 'applied the scale factor twice', 'arithmetic'],
    ],
    stem,
    expl: `The scale factor is $\\frac{${tri[0] * k}}{${tri[0]}}=${k}$. The smaller perimeter is $${tri[0] + tri[1] + tri[2]}$ meters, so the larger perimeter is $${tri[0] + tri[1] + tri[2]}\\times${k}=${per}$ meters.`,
    desmos: `(${tri[0]}+${tri[1]}+${tri[2]})*${k}`,
    note: 'Perimeters of similar figures scale by the same factor as the sides (areas scale by its square).',
    check: `checked the sides are $${tri[0] * k}$, $${tri[1] * k}$, $${tri[2] * k}$ and sum to ${per}`,
  };
}
reg({ fn: gSimilarWord, domain: GEO_DOMAIN, skill: 'Similar-triangle word problems', count: 9, spr: true });

/* ---- Pythagorean theorem ---- */
function gPythagoras(r, L) {
  const tri = r.pick(TRIPLES);
  const k = r.int(1, 2 + L);
  const a = tri[0] * k;
  const b = tri[1] * k;
  const c = tri[2] * k;
  if (L >= 3 && r.chance(0.4)) {
    const per = a + b + c;
    return {
      num: per,
      text: num(per),
      spr: num(per),
      alts: [
        [a + b, String(a + b), 'omitted the hypotenuse from the perimeter', 'setup'],
        [Math.round((per * 2 - c) * 1e6) / 1e6, String(per * 2 - c), 'counted one side twice', 'arithmetic'],
        [c, String(c), 'gave the hypotenuse only', 'misread'],
      ],
      stem: `A right triangle has legs of length ${a} and ${b}. What is the perimeter of the triangle?`,
      expl: `The hypotenuse is $\\sqrt{${a * a}+${b * b}}=${c}$, so the perimeter is $${a}+${b}+${c}=${per}$. The perimeter needs all three sides, including the one not given directly.`,
      desmos: `${a}+${b}+sqrt(${a}^2+${b}^2)`,
      note: 'Find the missing hypotenuse first, then add all three sides.',
      check: `checked $${a}^2+${b}^2=${c * c}$ and $${a}+${b}+${c}=${per}$`,
    };
  }
  const askHyp = r.chance(0.55);
  if (askHyp) {
    const stem = `A right triangle has legs of length ${a} and ${b}. What is the length of its hypotenuse?`;
    return {
      num: c,
      text: num(c),
      spr: num(c),
      alts: [
        [a + b, 'added the legs instead of using the Pythagorean theorem', 'concept'],
        [a * a + b * b, 'gave $a^2+b^2$ and forgot the square root', 'algebra'],
        [Math.sqrt(Math.abs(a * a - b * b)), `${sqrtTex(Math.abs(a * a - b * b))}`, 'subtracted the squares instead of adding them', 'sign'],
      ],
      stem,
      expl: `By the Pythagorean theorem $c^2=${a}^2+${b}^2=${a * a}+${b * b}=${c * c}$, so $c=${c}$. The hypotenuse is the longest side, which is why the two leg squares are added.`,
      desmos: `sqrt(${a}^2+${b}^2)`,
      note: 'The hypotenuse is the longest side; $a^2+b^2$ must be summed before the square root.',
      check: `checked $${a}^2+${b}^2=${a * a}+${b * b}=${c * c}=${c}^2$`,
    };
  }
  const stem = `A right triangle has a hypotenuse of length ${c} and one leg of length ${a}. What is the length of the other leg?`;
  return {
    num: b,
    text: num(b),
    spr: num(b),
    alts: [
      [Math.round(Math.sqrt(c * c + a * a) * 1e6) / 1e6, 'added the squares instead of subtracting', 'sign'],
      [c - a, 'subtracted the lengths instead of the squares', 'concept'],
      [Math.round((c * c - a * a) * 1e6) / 1e6, 'gave $c^2-a^2$ and forgot the square root', 'algebra'],
    ],
    stem,
    expl: `The missing leg satisfies $b^2=${c}^2-${a}^2=${c * c}-${a * a}=${b * b}$, so $b=${b}$. Because the hypotenuse is known, the known leg's square is subtracted rather than added.`,
    desmos: `sqrt(${c}^2-${a}^2)`,
    note: 'When the hypotenuse is known, subtract the known square; the answer must be shorter than the hypotenuse.',
    check: `checked $${a}^2+${b}^2=${c * c}$ and $${b}<${c}$`,
  };
}
reg({ fn: gPythagoras, domain: GEO_DOMAIN, skill: 'Pythagorean theorem', count: 10, spr: true });

/* ---- 45-45-90 ---- */
function gTri45(r, L) {
  const k = r.int(3, 9 + 3 * L);
  if (L >= 3 && r.chance(0.35)) {
    // two-step: hypotenuse -> area of the triangle
    const even = k % 2 === 0 ? k : k + 1;
    const area = (even * even) / 2;
    return {
      num: area,
      text: num(area),
      spr: num(area),
      alts: [
        [even * even, String(even * even), 'gave the square of the leg instead of half of it', 'concept'],
        [even * 2, String(even * 2), 'gave the hypotenuse of the legs', 'misread'],
        [Math.round((even * Math.SQRT2) * 1e6) / 1e6, num(Math.round(even * Math.SQRT2 * 1e6) / 1e6), 'used the hypotenuse as a leg', 'setup'],
      ],
      stem: `In a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle, the hypotenuse has length $${even}\\sqrt{2}$. What is the area of the triangle, in square units?`,
      expl: `Each leg is $\\frac{${even}\\sqrt{2}}{\\sqrt{2}}=${even}$. The triangle is right-angled with both legs ${even}, so its area is $\\frac{1}{2}(${even})(${even})=${area}$ square units.`,
      desmos: `${even}^2/2`,
      note: 'Recover a leg from the hypotenuse first, then use $\\frac{1}{2}bh$ with the two legs.',
      check: `checked $${even}^2+${even}^2=${2 * even * even}$ and area $=\\frac{1}{2}\\times${even * even}=${area}$`,
    };
  }
  const askLeg = r.chance(0.5);
  if (askLeg) {
    const hypTex = k === 1 ? '\\sqrt{2}' : `${k}\\sqrt{2}`;
    const stem = `In a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle, the hypotenuse has length $${hypTex}$. What is the length of each leg?`;
    return {
      num: k,
      text: num(k),
      spr: num(k),
      alts: [
        [k * Math.SQRT2, `${k}\\sqrt{2}`, 'multiplied by $\\sqrt{2}$ instead of dividing', 'concept'],
        [2 * k, String(2 * k), 'used the $30$-$60$-$90$ hypotenuse ratio', 'setup'],
        [Math.round((k / 2) * 1e6) / 1e6, 'halved the hypotenuse', 'arithmetic'],
      ],
      stem,
      expl: `In an isosceles right triangle the hypotenuse is $\\sqrt{2}$ times a leg, so each leg is $\\frac{${hypTex}}{\\sqrt{2}}=${k}$.`,
      desmos: `${k}*sqrt(2)/sqrt(2)`,
      note: 'Divide by $\\sqrt{2}$ to go from the hypotenuse back to a leg.',
      check: `checked $${k}\\sqrt{2}\\times\\sqrt{2}=${2 * k}$ and $${k}^2+${k}^2=${2 * k * k}$`,
    };
  }
  const hypTex = k === 1 ? '\\sqrt{2}' : `${k}\\sqrt{2}`;
  const stem = `In a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle, each leg has length ${k}. What is the length of the hypotenuse?`;
  return {
    num: k * Math.SQRT2,
    text: hypTex,
    alts: [
      [2 * k, 'used the $30$-$60$-$90$ relationship', 'setup'],
      [k * Math.sqrt(3), `${k}\\sqrt{3}`, 'used $\\sqrt{3}$ instead of $\\sqrt{2}$', 'concept'],
      [k, 'assumed the hypotenuse equals the leg', 'misread'],
    ],
    stem,
    expl: `The hypotenuse of a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle is $\\sqrt{2}$ times each leg, so it is $${k}\\sqrt{2}$.`,
    desmos: `${k}*sqrt(2)`,
    note: 'Isosceles right triangles have sides in the ratio $1:1:\\sqrt{2}$.',
    check: `checked $${k}^2+${k}^2=${2 * k * k}$ and $(${k}\\sqrt{2})^2=2\\times${k * k}$`,
  };
}
reg({ fn: gTri45, domain: GEO_DOMAIN, skill: '45-45-90 triangles', count: 9, spr: true });

/* ---- 30-60-90 ---- */
function gTri3060(r, L) {
  const s = r.int(2, 7 + 2 * L);
  const kind = r.int(0, L >= 3 ? 3 : 2);
  const longTex = s === 1 ? '\\sqrt{3}' : `${s}\\sqrt{3}`;
  if (kind === 0) {
    const stem = `In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle, the side opposite the $30^\\circ$ angle has length ${s}. What is the length of the hypotenuse?`;
    return {
      num: 2 * s,
      text: num(2 * s),
      spr: num(2 * s),
      alts: [
        [Math.round((s * Math.SQRT2) * 1e6) / 1e6, 'multiplied by $\\sqrt{2}$ as if the triangle were isosceles right', 'concept'],
        [s, 'assumed the hypotenuse equals the shortest side', 'misread'],
        [Math.round((s * Math.sqrt(3)) * 1e6) / 1e6, 'gave the longer leg', 'misread'],
      ],
      stem,
      expl: `In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle the hypotenuse is twice the shortest side, so it is $2\\times${s}=${2 * s}$.`,
      desmos: `2*${s}`,
      note: 'The side opposite $30^\\circ$ is the shortest; the hypotenuse is twice it.',
      check: `checked $${s}^2+${longTex.replace('\\sqrt{3}', '*sqrt(3)')}^2=(${2 * s})^2$ numerically: ${s * s}+${3 * s * s}=${4 * s * s}`,
    };
  }
  if (kind === 1) {
    const stem = `In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle, the hypotenuse has length ${2 * s}. What is the length of the side opposite the $30^\\circ$ angle?`;
    return {
      num: s,
      text: num(s),
      spr: num(s),
      alts: [
        [4 * s, 'doubled the hypotenuse instead of halving it', 'concept'],
        [Math.round((2 * s / Math.SQRT2) * 1e6) / 1e6, 'divided by $\\sqrt{2}$ instead of $2$', 'setup'],
        [Math.round((s * Math.sqrt(3)) * 1e6) / 1e6, 'gave the longer leg', 'misread'],
      ],
      stem,
      expl: `The hypotenuse is twice the shortest side, so the side opposite $30^\\circ$ is $${2 * s}\\div2=${s}$.`,
      desmos: `${2 * s}/2`,
      note: 'Halve the hypotenuse to recover the shortest side.',
      check: `checked $${s}^2+${3 * s * s}=${4 * s * s}=(${2 * s})^2$`,
    };
  }
  if (kind === 3) {
    // two-step: long leg -> hypotenuse
    return {
      num: 2 * s,
      text: num(2 * s),
      spr: num(2 * s),
      alts: [
        [Math.round(s * Math.sqrt(3) * 1e6) / 1e6, num(Math.round(s * Math.sqrt(3) * 1e6) / 1e6), 'kept the longer leg as the answer', 'misread'],
        [Math.round((s * Math.sqrt(3) * 2) * 1e6) / 1e6, num(Math.round(s * Math.sqrt(3) * 2) * 1e6), 'doubled the longer leg instead of dividing by $\\sqrt{3}$ first', 'concept'],
        [s, String(s), 'gave the shorter leg', 'misread'],
      ],
      stem: `In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle, the side opposite the $60^\\circ$ angle has length $${longTex}$. What is the length of the hypotenuse?`,
      expl: `The longer leg is $\\sqrt{3}$ times the shorter leg, so the shorter leg is $\\frac{${longTex}}{\\sqrt{3}}=${s}$. The hypotenuse is twice the shorter leg, $2\\times${s}=${2 * s}$.`,
      desmos: `${s}*sqrt(3)/sqrt(3)*2`,
      note: 'Two steps: divide by $\\sqrt{3}$ to reach the short leg, then double it for the hypotenuse.',
      check: `checked $${s}^2+${3 * s * s}=${4 * s * s}=(${2 * s})^2$`,
    };
  }
  const stem = `In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle, the side opposite the $30^\\circ$ angle has length ${s}. What is the length of the side opposite the $60^\\circ$ angle?`;
  return {
    num: s * Math.sqrt(3),
    text: longTex,
    alts: [
      [s * 2, '$' + 2 * s + '$', 'gave the hypotenuse', 'misread'],
      [s * Math.SQRT2, '$' + s + '\\sqrt{2}$', 'used $\\sqrt{2}$ instead of $\\sqrt{3}$', 'concept'],
      [Math.round((s / Math.sqrt(3)) * 1e6) / 1e6, 'divided by $\\sqrt{3}$ instead of multiplying', 'setup'],
    ],
    stem,
    expl: `The longer leg is $\\sqrt{3}$ times the shortest side, so it is $${s}\\sqrt{3}$. The sides of a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle are in the ratio $1:\\sqrt{3}:2$.`,
    desmos: `${s}*sqrt(3)`,
    note: 'The sides of a $30$-$60$-$90$ triangle are in the ratio $1:\\sqrt{3}:2$.',
    check: `checked $${s}^2+(${s}\\sqrt{3})^2=${s * s}+${3 * s * s}=${4 * s * s}=(${2 * s})^2$`,
  };
}
reg({ fn: gTri3060, domain: GEO_DOMAIN, skill: '30-60-90 triangles', count: 9, spr: true });

/* ---- trig ratios in right triangles ---- */
function gTrigRatios(r, L) {
  const tri = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [6, 8, 10], [12, 16, 20]]);
  const [a, b, c] = tri; // a = BC (opposite A), b = AC (adjacent A), c = AB (hypotenuse)
  const angle = r.chance(0.5) ? 'A' : 'B';
  const fns = ['sin', 'cos', 'tan'];
  const fn = r.pick(fns);
  let numr, den;
  if (angle === 'A') {
    if (fn === 'sin') { numr = a; den = c; }
    else if (fn === 'cos') { numr = b; den = c; }
    else { numr = a; den = b; }
  } else {
    if (fn === 'sin') { numr = b; den = c; }
    else if (fn === 'cos') { numr = a; den = c; }
    else { numr = b; den = a; }
  }
  const opp = angle === 'A' ? a : b;
  const adj = angle === 'A' ? b : a;
  const stem = `In right triangle $ABC$, the right angle is at $C$, $AB=${c}$, $BC=${a}$, and $AC=${b}$. What is $\\${fn} ${angle}$?`;
  const alts = [];
  if (fn === 'sin') alts.push([adj / c, 'used the adjacent leg instead of the opposite leg', 'concept'], [c / opp, 'inverted the ratio', 'setup']);
  if (fn === 'cos') alts.push([opp / c, 'used the opposite leg instead of the adjacent leg', 'concept'], [c / adj, 'inverted the ratio', 'setup']);
  if (fn === 'tan') alts.push([adj / opp, 'inverted the ratio', 'setup'], [opp / c, 'used the hypotenuse instead of the adjacent leg', 'concept']);
  alts.push([Math.round(((numr + 1) / den) * 1e6) / 1e6, 'changed one side length by one', 'arithmetic']);
  return {
    num: numr / den,
    text: frac(numr, den),
    spr: fracPlain(numr, den),
    alts,
    stem,
    expl: `For angle $${angle}$, the opposite side is ${opp}, the adjacent side is ${adj}, and the hypotenuse is ${c}. So $\\${fn} ${angle}=${gcd(numr, den) === 1 ? `\\frac{${numr}}{${den}}` : `\\frac{${numr}}{${den}}=${frac(numr, den)}`}$, keeping opposite, adjacent, and hypotenuse in their SOH-CAH-TOA positions.`,
    desmos: `${numr}/${den}`,
    note: 'SOH-CAH-TOA: sine is opposite over hypotenuse, cosine adjacent over hypotenuse, tangent opposite over adjacent.',
    check: `checked $${opp}^2+${adj}^2=${c}^2$ and the ratio $${numr}/${den}$`,
  };
}
reg({ fn: gTrigRatios, domain: GEO_DOMAIN, skill: 'Sine, cosine, and tangent as ratios', count: 9, spr: true });

/* ---- cofunction identity ---- */
function gCofunction(r, L) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x0 = r.int(3, 12 + L);
    const a = r.int(2, 4);
    const c = r.int(4, 20);
    const d = 90 - a * x0 - c;
    if (d < 10 || d > 70) continue;
    const trig1 = r.chance(0.5) ? 'sin' : 'cos';
    const trig2 = trig1 === 'sin' ? 'cos' : 'sin';
    return {
      num: x0,
      text: num(x0),
      spr: num(x0),
      alts: [
        [Math.round(((d - c) / a) * 1e6) / 1e6, 'set the two angle expressions equal instead of using the complementary relationship', 'concept'],
        [Math.round(((90 + c - d) / a) * 1e6) / 1e6, 'added the given angle instead of subtracting it from $90$', 'sign'],
        [x0 + 1, 'arithmetic slip while solving', 'arithmetic'],
      ],
      stem: `If $\\${trig1}(${a}x+${c})^\\circ=\\${trig2}(${d})^\\circ$, what is the value of $x$?`,
      expl: `Sine and cosine of complementary angles are equal, so the two angles must add to $90^\\circ$: $${a}x+${c}+${d}=90$. Then $${a}x=${90 - c - d}$ and $x=${x0}$.`,
      desmos: `${a}x+${c}+${d}=90`,
      note: '$\\sin\\theta=\\cos(90^\\circ-\\theta)$, so the angle expressions add to $90^\\circ$ — they are not equal to each other.',
      check: `substituted $x=${x0}$: angles $${a * x0 + c}^\\circ$ and $${d}^\\circ$ sum to 90`,
    };
  }
  return null;
}
reg({ fn: gCofunction, domain: GEO_DOMAIN, skill: 'Cofunction identity', count: 9, spr: true });

/* ---- radians and degrees ---- */
function gRadians(r, L) {
  const k = r.int(1, 11 + 2 * L);
  const deg = 15 * k;
  const radTex = piFrac(k, 12);
  const askDeg = r.chance(0.5);
  if (askDeg) {
    const stem = `An angle measures $${radTex}$ radians. What is its measure, in degrees?`;
    return {
      num: deg,
      text: num(deg),
      spr: num(deg),
      alts: [
        [Math.round((k * 180) * 1e6) / 1e6, 'multiplied the numerator by $180$ and ignored the fraction\'s denominator', 'algebra'],
        [Math.round((deg / 2) * 1e6) / 1e6, 'used $\\frac{\\pi}{360}$ as the conversion factor', 'setup'],
        [k * 12, 'used the denominator as a multiplier', 'arithmetic'],
      ],
      stem,
      expl: `Multiply by $\\frac{180^\\circ}{\\pi}$: $${radTex}\\times\\frac{180}{\\pi}=${deg}^\\circ$. The $\\pi$ cancels, leaving $180$ divided by the fraction's denominator.`,
      desmos: `${k}*180/12`,
      note: 'Radians to degrees multiplies by $180/\\pi$.',
      check: `converted back: $${deg}\\times\\frac{\\pi}{180}=${radTex}$`,
    };
  }
  const stem = `An angle measures $${deg}^\\circ$. What is its measure, in radians?`;
  return {
    num: (k * Math.PI) / 12,
    text: radTex,
    alts: [
      [piFrac(k, 6), 'used $\\frac{\\pi}{180}$ with the wrong numerator', 'setup'],
      [piFrac(deg, 360), 'divided by $360$ instead of $180$', 'concept'],
      [piFrac(k * 2, 12), 'doubled the radian measure', 'arithmetic'],
    ],
    stem,
    expl: `Multiply by $\\frac{\\pi}{180}$: $${deg}\\times\\frac{\\pi}{180}=${radTex}$ radians. Since $180^\\circ=\\pi$ radians, every degree is $\\frac{\\pi}{180}$ radians.`,
    desmos: `${deg}*pi/180`,
    note: 'Degrees to radians multiplies by $\\pi/180$ and simplifies the fraction.',
    check: `converted back: $${radTex}\\times\\frac{180}{\\pi}=${deg}^\\circ$`,
  };
}
reg({ fn: gRadians, domain: GEO_DOMAIN, skill: 'Radians and degrees', count: 9, spr: true });

/* ---- arc length ---- */
function gArcLength(r, L) {
  const rad = r.int(3, 10);
  const theta = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 225, 270]);
  const ansTex = piFrac(rad * theta, 180);
  const stem = `A circle has radius ${rad} centimeters. A central angle measures $${theta}^\\circ$. What is the length of the arc intercepted by this central angle, in centimeters?`;
  return {
    num: (Math.PI * rad * theta) / 180,
    text: ansTex,
    alts: [
      [piFrac(rad * theta, 360), 'used the sector-area denominator, which halves the result', 'concept'],
      [piFrac(rad * rad * theta, 360), 'used the sector area formula instead of arc length', 'concept'],
      [piFrac(theta, 180), 'ignored the radius', 'setup'],
    ],
    stem,
    expl: `Arc length is $\\frac{${theta}}{360}$ of the circumference: $2\\pi(${rad})\\times\\frac{${theta}}{360}=${ansTex}$ centimeters.`,
    desmos: `2*pi*${rad}*${theta}/360`,
    note: 'Arc length uses the circumference $2\\pi r$; sector area uses $\\pi r^2$.',
    check: `checked as $\\frac{${theta}}{360}\\times2\\pi\\times${rad}$, coefficient $\\frac{${rad * theta}}{180}$`,
  };
}
reg({ fn: gArcLength, domain: GEO_DOMAIN, skill: 'Arc length', count: 9, spr: false });

/* ---- sector area ---- */
function gSectorArea(r, L) {
  const rad = r.int(3, 10);
  const theta = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 225, 270]);
  const ansTex = piFrac(rad * rad * theta, 360);
  const stem = `A circle has radius ${rad} meters. A sector has a central angle of $${theta}^\\circ$. What is the area of the sector, in square meters?`;
  return {
    num: (Math.PI * rad * rad * theta) / 360,
    text: ansTex,
    alts: [
      [piFrac(rad * theta, 180), 'used the arc length formula instead of the sector area formula', 'concept'],
      [piFrac(rad * theta, 360), 'used $r$ instead of $r^2$', 'setup'],
      [piFrac(rad * rad * theta, 180), 'doubled the sector area', 'arithmetic'],
    ],
    stem,
    expl: `Sector area is $\\frac{${theta}}{360}$ of the circle's area: $\\pi(${rad})^2\\times\\frac{${theta}}{360}=${ansTex}$ square meters.`,
    desmos: `pi*${rad}^2*${theta}/360`,
    note: 'Sector area scales with $r^2$, so the radius must be squared.',
    check: `checked as $\\frac{${theta}}{360}\\times\\pi\\times${rad * rad}$, coefficient $\\frac{${rad * rad * theta}}{360}$`,
  };
}
reg({ fn: gSectorArea, domain: GEO_DOMAIN, skill: 'Sector area', count: 9, spr: false });

/* ---- circle equation: centre and radius ---- */
function sqBinom(v, c) {
  if (c === 0) return v;
  return c > 0 ? `(${v}-${c})` : `(${v}+${-c})`;
}

function gCircleEq(r, L) {
  let h = r.int(-8, 8);
  if (h === 0) h = 3;
  let k = r.int(-8, 8);
  if (k === 0) k = -4;
  if (k === h || k === -h) k = k > 0 ? k + 1 : k - 1;
  const rad = r.int(3, 9 + L);
  const eq = `$${sqBinom('x', h)}^2+${sqBinom('y', k)}^2=${rad * rad}$`;
  const askRadius = r.chance(0.6);
  if (askRadius) {
    return {
      num: rad,
      text: num(rad),
      spr: num(rad),
      alts: [
        [rad * rad, 'gave $r^2$ and forgot the square root', 'algebra'],
        [2 * rad, 'gave the diameter', 'misread'],
        [Math.round((rad / 2) * 1e6) / 1e6, 'halved the radius', 'arithmetic'],
      ],
      stem: `A circle in the $xy$-plane is defined by the equation ${eq}. What is the radius of the circle?`,
      expl: `The equation is already in standard form $(x-h)^2+(y-k)^2=r^2$ with $r^2=${rad * rad}$, so $r=${rad}$. The right-hand side is $r^2$, and the centre's coordinates have the opposite signs to the numbers inside the parentheses.`,
      desmos: eq.replace(/\^2/g, '^2'),
      note: 'The constant on the right is $r^2$; the radius is its square root.',
      check: `checked $${rad}^2=${rad * rad}$ and that the centre $(${h},${k})$ matches the signs inside the parentheses`,
    };
  }
  return {
    num: null,
    text: `$(${h},${k})$`,
    alts: [
      [null, `$(${h},${-k})$`, 'flipped the sign of the $y$-coordinate only', 'sign'],
      [null, `$(${-h},${k})$`, 'flipped the sign of the $x$-coordinate only', 'sign'],
      [null, `$(${k},${h})$`, 'swapped the two coordinates', 'setup'],
    ],
    stem: `A circle in the $xy$-plane is defined by the equation ${eq}. What are the coordinates of the centre of the circle?`,
    expl: `In standard form $(x-h)^2+(y-k)^2=r^2$ the centre is $(h,k)$, so here the centre is $(${h},${k})$.`,
    desmos: eq,
    note: 'The centre coordinates are the opposite of the numbers inside the parentheses.',
    check: `read $(h,k)$ directly from the two binomials: $(${h},${k})$`,
  };
}
reg({ fn: gCircleEq, domain: GEO_DOMAIN, skill: 'Circle equations: centre and radius', count: 10, spr: true });

/* ---- circle equation: completing the square ---- */
function gCircleComplete(r, L) {
  let h = r.int(2, 9);
  let k = r.int(2, 9);
  const rad = r.int(4, 10 + L);
  const D = -2 * h;
  const E = -2 * k;
  const F = h * h + k * k - rad * rad;
  const term = (coef, v) => (coef === 0 ? '' : `${coef > 0 ? '+' : '-'}${Math.abs(coef)}${v}`);
  const eq = `x^2+y^2${term(D, 'x')}${term(E, 'y')}${term(F, '')}=0`;
  const askRadius = r.chance(0.65);
  if (askRadius) {
    return {
      num: rad,
      text: num(rad),
      spr: num(rad),
      alts: [
        [rad * rad, 'gave $r^2$ instead of the radius', 'algebra'],
        [Math.round(Math.sqrt(Math.abs(F)) * 1e6) / 1e6, 'square-rooted the constant term without completing the square', 'setup'],
        [2 * rad, 'gave the diameter', 'misread'],
      ],
      stem: `The equation ${eq.replace(/^/, '$') + '$'} defines a circle in the $xy$-plane. What is the radius of the circle?`,
      expl: `Complete the square: $(x-${h})^2+(y-${k})^2=${h * h}+${k * k}${F >= 0 ? '-' : '+'}${Math.abs(F)}=${rad * rad}$, so $r=${rad}$. Completing the square on both variables is what turns the expanded equation back into standard form.`,
      desmos: eq,
      note: 'Completing the square on both variables produces $r^2$ on the right, not the original constant.',
      check: `expanded back: $(x-${h})^2+(y-${k})^2=${rad * rad}$ gives $x^2+y^2${term(D, 'x')}${term(E, 'y')}${term(F, '')}=0$`,
    };
  }
  return {
    num: null,
    text: `$(${h},${k})$`,
    alts: [
      [null, `$(${-h},${-k})$`, 'kept the signs of the coefficients instead of halving and negating them', 'sign'],
      [null, `$(${h},${-k})$`, 'made a sign error on the $y$-coordinate', 'sign'],
      [null, `$(${D},${E})$`, 'used the coefficients themselves as the centre', 'concept'],
    ],
    stem: `The equation ${eq.replace(/^/, '$') + '$'} defines a circle in the $xy$-plane. What are the coordinates of the centre?`,
    expl: `Half of the $x$-coefficient is $${D / 2}$ and half of the $y$-coefficient is $${E / 2}$; the centre is the opposite of each, $(${h},${k})$.`,
    desmos: eq,
    note: 'After completing the square the centre is $(h,k)$ with $h=-D/2$ and $k=-E/2$.',
    check: `checked the completed form $(x-${h})^2+(y-${k})^2$ expands to the given coefficients $${D}$ and $${E}$`,
  };
}
reg({ fn: gCircleComplete, domain: GEO_DOMAIN, skill: 'Circle equations: completing the square', count: 10, spr: true });

/* ---- tangent perpendicular to radius ---- */
function gTangentRadius(r, L) {
  const tri = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
  const rad = tri[0];
  const tan = tri[1];
  const dist = tri[2];
  const askTan = r.chance(0.6);
  if (askTan) {
    return {
      num: tan,
      text: num(tan),
      spr: num(tan),
      alts: [
        [dist - rad, 'subtracted the radius from the distance', 'concept'],
        [dist + rad, 'added the radius to the distance', 'setup'],
        [Math.round(Math.sqrt(dist * dist + rad * rad) * 1e6) / 1e6, 'added the squares instead of subtracting', 'sign'],
      ],
      stem: `A circle with centre $O$ has radius ${rad}. A point $P$ is ${dist} units from $O$, and $PA$ is tangent to the circle at $A$. What is the length of $PA$?`,
      expl: `A tangent is perpendicular to the radius at the point of tangency, so $\\triangle OAP$ is right-angled at $A$. Then $PA^2=${dist}^2-${rad}^2=${dist * dist}-${rad * rad}=${tan * tan}$, so $PA=${tan}$.`,
      desmos: `sqrt(${dist}^2-${rad}^2)`,
      note: 'The tangent, the radius to the tangency point, and the segment to the external point form a right triangle.',
      check: `checked $${rad}^2+${tan}^2=${rad * rad}+${tan * tan}=${dist * dist}$`,
    };
  }
  return {
    num: rad,
    text: num(rad),
    spr: num(rad),
    alts: [
      [tan, 'gave the tangent length instead of the radius', 'misread'],
      [dist - tan, 'subtracted the tangent length from the distance', 'setup'],
      [Math.round(Math.sqrt(dist * dist + tan * tan) * 1e6) / 1e6, 'added the squares instead of subtracting', 'sign'],
    ],
    stem: `A circle has centre $O$. A point $P$ is ${dist} units from $O$, and $PA$ is tangent to the circle at $A$ with $PA=${tan}$. What is the radius of the circle?`,
    expl: `The radius is perpendicular to the tangent, so $OA^2=${dist}^2-${tan}^2=${dist * dist}-${tan * tan}=${rad * rad}$ and $OA=${rad}$. The right angle at the point of tangency is what allows the Pythagorean theorem to be used.`,
    desmos: `sqrt(${dist}^2-${tan}^2)`,
    note: 'In the right triangle, the segment from the centre to the external point is the hypotenuse.',
    check: `checked $${rad}^2+${tan}^2=${dist * dist}$ and $${rad}<${dist}$`,
  };
}
reg({ fn: gTangentRadius, domain: GEO_DOMAIN, skill: 'Tangent perpendicular to radius', count: 8, spr: true });

/* ---- composite areas ---- */
function gCompositeArea(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const w = r.int(3, 6 + L) * 2;
    const h = r.int(4, 10 + L);
    const base = w * h;
    const piCoef = piFrac(w * w, 8);
    const ans = base + (Math.PI * w * w) / 8;
    const stem = `A window is shaped like a rectangle of width ${w} feet and height ${h} feet with a semicircle attached along the entire top edge. The semicircle's diameter is the rectangle's top edge. What is the total area of the window, in square feet?`;
    return {
      num: ans,
      text: `${base}+${piCoef}`,
      alts: [
        [base + (Math.PI * w * w) / 4, `${base}+${piFrac(w * w, 4)}`, 'used a full circle instead of a semicircle', 'concept'],
        [base + (Math.PI * w * w) / 2, `${base}+${piFrac(w * w, 2)}`, 'used the diameter as the radius', 'setup'],
        [base, String(base), 'gave the rectangle only and ignored the semicircle', 'misread'],
      ],
      stem,
      expl: `The rectangle has area $${w}\\times${h}=${base}$. The semicircle has radius $\\frac{${w}}{2}=${w / 2}$, so its area is $\\frac{1}{2}\\pi(${w / 2})^2=${piCoef}$. The total is $${base}+${piCoef}$ square feet.`,
      desmos: `${w}*${h}+pi*(${w}/2)^2/2`,
      note: 'A semicircle uses half of $\\pi r^2$, and the radius is half the stated diameter.',
      check: `checked the semicircle coefficient $\\frac{1}{2}\\times\\frac{${w * w}}{4}=\\frac{${w * w}}{8}$`,
    };
  }
  if (kind === 1) {
    const s = r.int(4, 8 + L);
    const base = s * s;
    const piCoef = piFrac(s * s, 4);
    const ans = base - (Math.PI * s * s) / 4;
    const stem = `A square piece of metal has side length ${s} inches. A quarter circle of radius ${s}, centred at one corner of the square, is cut out of the metal. What is the area of the remaining metal, in square inches?`;
    return {
      num: ans,
      text: `${base}-${piCoef}`,
      alts: [
        [base - (Math.PI * s * s) / 2, `${base}-${piFrac(s * s, 2)}`, 'used a semicircle instead of a quarter circle', 'concept'],
        [base, String(base), 'gave the area of the square and ignored the cut-out', 'misread'],
        [base - (Math.PI * s * s) / 4 === ans ? base + (Math.PI * s * s) / 4 : base + (Math.PI * s * s) / 4, `${base}+${piCoef}`, 'added the quarter circle instead of subtracting it', 'sign'],
      ],
      stem,
      expl: `The square has area $${s}^2=${base}$. The quarter circle has area $\\frac{1}{4}\\pi(${s})^2=${piCoef}$, so the remaining area is $${base}-${piCoef}$ square inches.`,
      desmos: `${s}^2-pi*${s}^2/4`,
      note: 'A quarter circle is $\\frac{1}{4}\\pi r^2$; the cut-out is subtracted from the square.',
      check: `checked the quarter circle is one fourth of $\\pi\\times${s * s}$, i.e. $${piCoef}$`,
    };
  }
  const w = r.int(4, 6 + L) * 2;
  const h = r.int(6, 12 + L);
  const base = w * h;
  const piCoef = piFrac(w * w, 4);
  const ans = base + (Math.PI * w * w) / 4;
  const stem = `A running track is shaped like a rectangle of length ${h} meters and width ${w} meters with a semicircle attached to each of the two shorter sides. Each semicircle has diameter ${w} meters. What is the total area enclosed by the track, in square meters?`;
  return {
    num: ans,
    text: `${base}+${piCoef}`,
    alts: [
      [base + (Math.PI * w * w) / 8, `${base}+${piFrac(w * w, 8)}`, 'used only one semicircle', 'setup'],
      [base + (Math.PI * w * w) / 2, `${base}+${piFrac(w * w, 2)}`, 'used the diameter as the radius', 'concept'],
      [base, String(base), 'gave the rectangle only', 'misread'],
    ],
    stem,
    expl: `The two semicircles together make one full circle of radius $${w / 2}$, with area $\\pi(${w / 2})^2=${piCoef}$. Adding the rectangle gives $${base}+${piCoef}$ square meters.`,
    desmos: `${w}*${h}+pi*(${w}/2)^2`,
    note: 'Two semicircles of the same radius combine into one full circle.',
    check: `checked the circle area $\\pi\\times${w / 2}^2=${piCoef}$ plus rectangle ${base}`,
  };
}
reg({ fn: gCompositeArea, domain: GEO_DOMAIN, skill: 'Composite areas', count: 8, spr: false });

/* ---- volume of prisms and cylinders ---- */
function gVolumePrism(r, L) {
  if (r.chance(0.5)) {
    const l = r.int(3, 8 + L);
    const w = r.int(2, 7 + L);
    const h = r.int(4, 10 + L);
    const ans = l * w * h;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [2 * (l * w + l * h + w * h), 'computed surface area instead of volume', 'concept'],
        [l + w + h, 'added the dimensions', 'setup'],
        [l * w, 'gave the area of the base only', 'quantity'],
      ],
      stem: `A rectangular box has length ${l} centimeters, width ${w} centimeters, and height ${h} centimeters. What is the volume of the box, in cubic centimeters?`,
      expl: `Volume of a rectangular prism is length times width times height: $${l}\\times${w}\\times${h}=${ans}$ cubic centimeters.`,
      desmos: `${l}*${w}*${h}`,
      note: 'Volume multiplies all three dimensions; surface area is a sum of face areas.',
      check: `checked base area $${l}\\times${w}=${l * w}$ times height $${h}$`,
    };
  }
  const rad = r.int(2, 7 + L);
  const h = r.int(4, 12 + L);
  const ansTex = piFrac(rad * rad * h, 1);
  return {
    num: Math.PI * rad * rad * h,
    text: ansTex,
    alts: [
      [piFrac(2 * rad * h, 1), 'multiplied the circumference by the height', 'concept'],
      [piFrac(rad * h, 1), 'used $r$ instead of $r^2$', 'setup'],
      [piFrac(2 * rad * rad * h, 1), 'doubled the volume', 'arithmetic'],
    ],
    stem: `A cylindrical can has radius ${rad} inches and height ${h} inches. What is the volume of the can, in cubic inches?`,
    expl: `Volume of a cylinder is $\\pi r^2h=\\pi(${rad})^2(${h})=${ansTex}$ cubic inches. The base area $\\pi r^2$ is multiplied by the height, so the answer carries $\\pi$ and cubic units.`,
    desmos: `pi*${rad}^2*${h}`,
    note: 'A cylinder\'s volume is the base area $\\pi r^2$ times the height.',
    check: `checked base area $\\pi\\times${rad * rad}$ times height ${h} gives coefficient $${rad * rad * h}$`,
  };
}
reg({ fn: gVolumePrism, domain: GEO_DOMAIN, skill: 'Volume of prisms and cylinders', count: 10, spr: true });

/* ---- volume of pyramids and cones ---- */
function gVolumePyramid(r, L) {
  if (r.chance(0.5)) {
    const side = r.pick([3, 6, 9, 12]);
    const h = r.pick([5, 7, 8, 10]);
    const B = side * side;
    const ans = (B * h) / 3;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [B * h, 'forgot the factor of $\\frac{1}{3}$ for a pyramid', 'concept'],
        [Math.round(((B * h) / 2) * 1e6) / 1e6, 'used $\\frac{1}{2}$ instead of $\\frac{1}{3}$', 'setup'],
        [Math.round(((B * h) / 6) * 1e6) / 1e6, 'divided by $6$ instead of $3$', 'arithmetic'],
      ],
      stem: `A square pyramid has a base with side length ${side} meters and a height of ${h} meters. What is the volume of the pyramid, in cubic meters?`,
      expl: `The base area is $${side}^2=${B}$. The volume of a pyramid is $\\frac{1}{3}Bh=\\frac{1}{3}(${B})(${h})=${ans}$ cubic meters.`,
      desmos: `${side}^2*${h}/3`,
      note: 'A pyramid is one third of the prism with the same base and height.',
      check: `checked $3\\times${ans}=${B * h}=Bh$`,
    };
  }
  const rad = r.pick([3, 6, 9]);
  const h = r.pick([4, 7, 10]);
  const ansTex = piFrac(rad * rad * h, 3);
  return {
    num: (Math.PI * rad * rad * h) / 3,
    text: ansTex,
    alts: [
      [piFrac(rad * rad * h, 1), 'forgot the factor of $\\frac{1}{3}$ for a cone', 'concept'],
      [piFrac(rad * rad * h, 6), 'divided by $6$ instead of $3$', 'arithmetic'],
      [piFrac(2 * rad * rad * h, 3), 'doubled the volume', 'setup'],
    ],
    stem: `A cone has a base radius of ${rad} centimeters and a height of ${h} centimeters. What is the volume of the cone, in cubic centimeters?`,
    expl: `The volume of a cone is $\\frac{1}{3}\\pi r^2h=\\frac{1}{3}\\pi(${rad})^2(${h})=${ansTex}$ cubic centimeters.`,
    desmos: `pi*${rad}^2*${h}/3`,
    note: 'A cone is one third of the cylinder with the same radius and height.',
    check: `checked $3\\times${ansTex}=${piFrac(rad * rad * h, 1)}$`,
  };
}
reg({ fn: gVolumePyramid, domain: GEO_DOMAIN, skill: 'Volume of pyramids and cones', count: 8, spr: false });

/* ---- volume of a sphere ---- */
function gVolumeSphere(r, L) {
  const rad = r.pick([3, 6, 9, 12]);
  const ansTex = piFrac(4 * rad * rad * rad, 3);
  const stem = `A sphere has a radius of ${rad} inches. What is the volume of the sphere, in cubic inches?`;
  return {
    num: (4 / 3) * Math.PI * rad * rad * rad,
    text: ansTex,
    alts: [
      [piFrac(4 * rad * rad, 1), 'used the surface area formula', 'concept'],
      [piFrac(4 * rad * rad * rad, 1), 'forgot to divide by $3$', 'algebra'],
      [piFrac(2 * rad * rad * rad, 3), 'used $\\frac{2}{3}\\pi r^3$', 'setup'],
    ],
    stem,
    expl: `The volume of a sphere is $\\frac{4}{3}\\pi r^3=\\frac{4}{3}\\pi(${rad})^3=${ansTex}$ cubic inches. The cube and the $\\frac{4}{3}$ both come from the three-dimensional shape, and the result is in cubic units.`,
    desmos: `4/3*pi*${rad}^3`,
    note: 'Volume of a sphere is $\\frac{4}{3}\\pi r^3$; surface area is $4\\pi r^2$.',
    check: `checked $\\frac{4}{3}\\times${rad * rad * rad}=${(4 * rad * rad * rad) / 3}$ so the coefficient is $\\frac{${4 * rad * rad * rad}}{3}$`,
  };
}
reg({ fn: gVolumeSphere, domain: GEO_DOMAIN, skill: 'Volume of a sphere', count: 8, spr: false });

/* ---- surface area ---- */
function gSurfaceArea(r, L) {
  if (r.chance(0.55)) {
    const rad = r.pick([2, 3, 4, 5, 6, 8]);
    const ansTex = piFrac(4 * rad * rad, 1);
    return {
      num: 4 * Math.PI * rad * rad,
      text: ansTex,
      alts: [
        [piFrac(4 * rad * rad * rad, 3), 'used the volume formula', 'concept'],
        [piFrac(2 * rad * rad, 1), 'used $2\\pi r^2$', 'setup'],
        [piFrac(4 * rad, 1), 'used $r$ instead of $r^2$', 'algebra'],
      ],
      stem: `A spherical ball has a radius of ${rad} centimeters. What is the surface area of the ball, in square centimeters?`,
      expl: `Surface area of a sphere is $4\\pi r^2=4\\pi(${rad})^2=${ansTex}$ square centimeters. The radius is squared because surface area is measured in square units.`,
      desmos: `4*pi*${rad}^2`,
      note: 'Surface area of a sphere is $4\\pi r^2$ — squared, not cubed.',
      check: `checked $4\\times${rad * rad}=${4 * rad * rad}$ so the coefficient is $${4 * rad * rad}$`,
    };
  }
  const rad = r.int(2, 7);
  const h = r.int(3, 10);
  const ansTex = piFrac(2 * rad * (rad + h), 1);
  return {
    num: 2 * Math.PI * rad * (rad + h),
    text: ansTex,
    alts: [
      [piFrac(2 * rad * h, 1), 'gave the lateral area only, omitting the two circular bases', 'concept'],
      [piFrac(rad * (rad + h), 1), 'forgot that there are two circular bases', 'setup'],
      [piFrac(2 * rad * rad * h, 1), 'computed a volume-like product', 'misread'],
    ],
    stem: `A closed cylindrical tank has radius ${rad} feet and height ${h} feet. What is the total surface area of the tank, in square feet?`,
    expl: `Total surface area is $2\\pi r^2+2\\pi rh=2\\pi(${rad})^2+2\\pi(${rad})(${h})=${ansTex}$ square feet. There are two circular bases plus the lateral surface, which is why both terms carry a factor of $2$.`,
    desmos: `2*pi*${rad}^2+2*pi*${rad}*${h}`,
    note: 'A closed cylinder has two circular bases plus the lateral rectangle.',
    check: `checked $2\\times${rad}\\times(${rad}+${h})=${2 * rad * (rad + h)}$ so the coefficient is $${2 * rad * (rad + h)}$`,
  };
}
reg({ fn: gSurfaceArea, domain: GEO_DOMAIN, skill: 'Surface area of spheres and cylinders', count: 8, spr: false });

/* ---- density and volume ---- */
function gDensityVolume(r, L) {
  const dens = r.pick([2.5, 2.7, 3.2, 4.5, 7.8, 8.9, 11.3]);
  const vol = r.int(200, 900 + 300 * L);
  const massG = Math.round(dens * vol * 1e6) / 1e6;
  const ans = Math.round((massG / 1000) * 1e6) / 1e6;
  const stem = `A metal object has a volume of ${vol} cubic centimeters. The metal has a density of ${num(dens)} grams per cubic centimeter. What is the mass of the object, in kilograms?`;
  return {
    num: ans,
    text: num(ans),
    spr: num(ans),
    alts: [
      [massG, 'gave the mass in grams instead of kilograms', 'unit'],
      [Math.round((vol / dens) * 1e6) / 1e6, 'divided volume by density', 'concept'],
      [Math.round((massG / 100) * 1e6) / 1e6, 'divided by $100$ instead of $1000$', 'unit'],
    ],
    stem,
    expl: `Mass is density times volume: $${num(dens)}\\times${vol}=${num(massG)}$ grams. Since $1000$ grams make a kilogram, the mass is ${num(ans)} kilograms.`,
    desmos: `${num(dens)}*${vol}/1000`,
    note: 'Two steps: density times volume, then grams to kilograms.',
    check: `checked $${num(ans)}\\times1000=${num(massG)}$ grams and $${num(massG)}\\div${vol}=${num(dens)}$`,
  };
}
reg({ fn: gDensityVolume, domain: GEO_DOMAIN, skill: 'Density and volume', count: 8, spr: true });

/* ---- coordinate geometry ---- */
function gCoordGeom(r, L) {
  const tri = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]]);
  const x1 = r.int(-6, 6);
  const y1 = r.int(-6, 6);
  const sx = r.chance(0.5) ? 1 : -1;
  const sy = r.chance(0.5) ? 1 : -1;
  const x2 = x1 + sx * tri[0];
  const y2 = y1 + sy * tri[1];
  const kind = r.int(0, 2);
  if (kind === 0) {
    return {
      num: tri[2],
      text: num(tri[2]),
      spr: num(tri[2]),
      alts: [
        [tri[0] + tri[1], 'added the horizontal and vertical distances', 'concept'],
        [Math.abs(x2 - x1), 'gave only the horizontal distance', 'setup'],
        [Math.abs(y2 - y1), 'gave only the vertical distance', 'setup'],
      ],
      stem: `Points $A(${x1},${y1})$ and $B(${x2},${y2})$ are plotted in the $xy$-plane. What is the distance between $A$ and $B$?`,
      expl: `The differences are $\\Delta x=${x2 - x1}$ and $\\Delta y=${y2 - y1}$, so the distance is $\\sqrt{${(x2 - x1) ** 2}+${(y2 - y1) ** 2}}=${tri[2]}$.`,
      desmos: `sqrt((${x2}-${x1})^2+(${y2}-${y1})^2)`,
      note: 'Distance uses the Pythagorean theorem on the coordinate differences.',
      check: `checked $${Math.abs(x2 - x1)}^2+${Math.abs(y2 - y1)}^2=${tri[2] * tri[2]}$`,
    };
  }
  if (kind === 1) {
    const mx = (x1 + x2) / 2;
    return {
      num: mx,
      text: num(mx),
      spr: num(mx),
      alts: [
        [x1 + x2, 'forgot to divide by $2$', 'algebra'],
        [x2 - x1, 'subtracted the coordinates instead of averaging', 'concept'],
        [y1 + y2, 'averaged neither and used the $y$-coordinates', 'misread'],
      ],
      stem: `Points $A(${x1},${y1})$ and $B(${x2},${y2})$ are plotted in the $xy$-plane. What is the $x$-coordinate of the midpoint of segment $AB$?`,
      expl: `The midpoint's $x$-coordinate is the average $\\frac{${x1}+(${x2})}{2}=${num(mx)}$. A midpoint averages the endpoints, so it always lies exactly halfway along the segment.`,
      desmos: `(${x1}+${x2})/2`,
      note: 'A midpoint averages the coordinates; it does not subtract them.',
      check: `checked $${num(mx)}-${x1}=${num(x2 - mx)}$ so ${num(mx)} is equidistant from ${x1} and ${x2}`,
    };
  }
  const slope = (y2 - y1) / (x2 - x1);
  return {
    num: slope,
    text: frac(y2 - y1, x2 - x1),
    spr: fracPlain(y2 - y1, x2 - x1),
    alts: [
      [Math.round(((x2 - x1) / (y2 - y1)) * 1e6) / 1e6, 'inverted the slope ratio', 'setup'],
      [-slope, 'dropped the sign of the slope', 'sign'],
      [y2 - y1, 'gave the vertical change only', 'quantity'],
    ],
    stem: `Points $A(${x1},${y1})$ and $B(${x2},${y2})$ lie in the $xy$-plane. What is the slope of line $AB$?`,
    expl: `Slope is change in $y$ over change in $x$: $\\frac{${y2}-(${y1})}{${x2}-(${x1})}=\\frac{${y2 - y1}}{${x2 - x1}}=${frac(y2 - y1, x2 - x1)}$. The rise carries the sign of the vertical change and the run the sign of the horizontal change.`,
    desmos: `(${y2}-${y1})/(${x2}-${x1})`,
    note: 'Slope is the vertical change divided by the horizontal change, with signs kept.',
    check: `checked rise $${y2 - y1}$ over run $${x2 - x1}$ reduces to $${frac(y2 - y1, x2 - x1)}$`,
  };
}
reg({ fn: gCoordGeom, domain: GEO_DOMAIN, skill: 'Coordinate geometry: distance, midpoint, and slope', count: 10, spr: true });

/* ---- parallel and perpendicular slopes ---- */
const RATIONAL_SLOPES = [[2, 1], [3, 1], [4, 1], [5, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2], [3, 2], [-2, 3], [5, 2], [-3, 4]];

function gPerpParallel(r, L) {
  const [p, q] = r.pick(RATIONAL_SLOPES);
  const m = p / q;
  const b = r.int(-6, 8);
  const mText = frac(p, q);
  const lineEq = `$y=${mText}x${b >= 0 ? '+' : '-'}${Math.abs(b)}$`;
  const kind = r.int(0, 2);
  if (kind === 0) {
    const perpText = frac(-q, p);
    return {
      num: -q / p,
      text: perpText,
      spr: fracPlain(-q, p),
      alts: [
        [m, mText, 'gave the slope of a parallel line', 'concept'],
        [-m, frac(-p, q), 'negated the slope without taking the reciprocal', 'setup'],
        [q / p, frac(q, p), 'took the reciprocal without negating', 'sign'],
      ],
      stem: `Line $k$ has equation ${lineEq}. What is the slope of a line perpendicular to line $k$?`,
      expl: `The slope of line $k$ is $${mText}$. Perpendicular slopes multiply to $-1$, so the required slope is the negative reciprocal, $${perpText}$.`,
      desmos: `-1/(${p}/${q})`,
      note: 'Perpendicular means negative reciprocal: flip the sign and invert the fraction.',
      check: `checked the product: $${mText}\\times${perpText}=-1$`,
    };
  }
  if (kind === 1) {
    const x1 = r.int(-5, 5);
    const y1 = r.int(-6, 8);
    const intercept = Math.round((y1 - m * x1) * 1e6) / 1e6;
    return {
      num: intercept,
      text: num(intercept),
      spr: num(intercept),
      alts: [
        [b, String(b), 'gave the $y$-intercept of line $k$ itself', 'misread'],
        [Math.round((y1 + m * x1) * 1e6) / 1e6, 'added the slope term instead of subtracting it', 'sign'],
        [Math.round((y1 - (-1 / m) * x1) * 1e6) / 1e6, 'used the perpendicular slope for a parallel line', 'setup'],
      ],
      stem: `Line $k$ has equation ${lineEq}. A line parallel to line $k$ passes through the point $(${x1},${y1})$. What is the $y$-intercept of this line?`,
      expl: `A parallel line has slope $${mText}$. Substituting $(${x1},${y1})$ into $y=${mText}x+b$ gives $${y1}=${num(Math.round(m * x1 * 1e6) / 1e6)}+b$, so $b=${num(intercept)}$.`,
      desmos: `${y1}-(${p}/${q})*${x1}`,
      note: 'Parallel lines share the slope; then solve for the new intercept with the given point.',
      check: `checked ${num(Math.round(m * 100) / 100)}\\times${x1}+${num(intercept)}=${y1}`,
    };
  }
  const x1 = r.int(-5, 5);
  const y1 = r.int(-6, 8);
  const slope = -1 / m;
  const intercept = Math.round((y1 - slope * x1) * 1e6) / 1e6;
  return {
    num: intercept,
    text: num(intercept),
    spr: num(intercept),
    alts: [
      [b, String(b), 'gave the $y$-intercept of line $k$ itself', 'misread'],
      [Math.round((y1 + slope * x1) * 1e6) / 1e6, 'added the slope term instead of subtracting it', 'sign'],
      [Math.round((y1 - m * x1) * 1e6) / 1e6, 'used the slope of line $k$ instead of the perpendicular slope', 'setup'],
    ],
    stem: `Line $k$ has equation ${lineEq}. A line perpendicular to line $k$ passes through the point $(${x1},${y1})$. What is the $y$-intercept of this line?`,
    expl: `The perpendicular slope is $-\\frac{1}{${mText}}=${frac(-q, p)}$. Substituting $(${x1},${y1})$ gives $${y1}=${frac(-q, p)}(${x1})+b$, so $b=${num(intercept)}$.`,
    desmos: `${y1}-(-${q}/${p})*${x1}`,
    note: 'Take the negative reciprocal of the slope before solving for $b$.',
    check: `checked the point with the perpendicular slope: $${num(Math.round(slope * 100) / 100)}\\times${x1}+${num(intercept)}=${y1}$`,
  };
}
reg({ fn: gPerpParallel, domain: GEO_DOMAIN, skill: 'Parallel and perpendicular slopes', count: 9, spr: true });

/* ---- dilations: area k^2, volume k^3 ---- */
function gDilationScale(r, L) {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const k = r.int(2, 5);
    const A = r.int(4, 12 + L);
    const ans = A * k * k;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [A * k, 'scaled the area by $k$ instead of $k^2$', 'concept'],
        [A * k * k * k, 'scaled the area by $k^3$', 'setup'],
        [A + k, 'added the scale factor instead of multiplying', 'algebra'],
      ],
      stem: `A figure with area ${A} square units is dilated by a scale factor of ${k}. What is the area of the image, in square units?`,
      expl: `Under a dilation with scale factor ${k}, areas scale by $k^2=${k * k}$. The image area is $${A}\\times${k * k}=${ans}$ square units.`,
      desmos: `${A}*${k}^2`,
      note: 'Lengths scale by $k$, areas by $k^2$, volumes by $k^3$.',
      check: `checked $${ans}\\div${A}=${k * k}=${k}^2$`,
    };
  }
  if (kind === 1) {
    const k = r.int(2, 4);
    const V = r.int(3, 10);
    const ans = V * k * k * k;
    return {
      num: ans,
      text: num(ans),
      spr: num(ans),
      alts: [
        [V * k, 'scaled the volume by $k$ instead of $k^3$', 'concept'],
        [V * k * k, 'scaled the volume by $k^2$', 'setup'],
        [V + k, 'added the scale factor', 'algebra'],
      ],
      stem: `A solid with volume ${V} cubic units is dilated by a scale factor of ${k}. What is the volume of the image, in cubic units?`,
      expl: `Volumes scale by $k^3=${k * k * k}$, so the image volume is $${V}\\times${k * k * k}=${ans}$ cubic units.`,
      desmos: `${V}*${k}^3`,
      note: 'Volume in three dimensions scales by the cube of the scale factor.',
      check: `checked $${ans}\\div${V}=${k * k * k}=${k}^3$`,
    };
  }
  const k = r.int(2, 6);
  const A = r.int(3, 9);
  const newA = A * k * k;
  return {
    num: k,
    text: num(k),
    spr: num(k),
    alts: [
      [Math.round((newA / A) * 1e6) / 1e6, 'gave the area ratio $k^2$ instead of $k$', 'concept'],
      [Math.round(Math.sqrt(newA) * 1e6) / 1e6, 'took the square root of the new area alone', 'setup'],
      [A, 'assumed the scale factor equals the original area', 'misread'],
    ],
    stem: `A figure with area ${A} square units is dilated, and the image has area ${newA} square units. What is the scale factor of the dilation?`,
    expl: `Areas scale by $k^2$, so $k^2=\\frac{${newA}}{${A}}=${k * k}$ and $k=${k}$. The area ratio is not the scale factor itself; its square root is.`,
    desmos: `sqrt(${newA}/${A})`,
    note: 'Recover a scale factor from areas by taking the square root of the area ratio.',
    check: `checked $${A}\\times${k}^2=${newA}$`,
  };
}
reg({ fn: gDilationScale, domain: GEO_DOMAIN, skill: 'Dilations: area and volume scaling', count: 8, spr: true });

/* ================================================================== *
 * 8. Plan: counts, tiers, item types
 * ================================================================== */

const TIERS = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
const TIER_WEIGHTS = [0.25, 0.3, 0.25, 0.15, 0.05];

function tierTargets(n) {
  const raw = TIER_WEIGHTS.map((w) => w * n);
  const base = raw.map((v) => Math.floor(v));
  const left = n - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) base[order[k % 5][1]]++;
  return base;
}

function buildPlan() {
  const gens = REG.map((g) => ({ ...g, n: g.count }));
  const pad = (domain, target) => {
    const pool = gens.filter((g) => g.domain === domain);
    let total = pool.reduce((a, g) => a + g.n, 0);
    let k = 0;
    while (total < target) {
      pool[k % pool.length].n++;
      k++;
      total++;
    }
    return total;
  };
  const dataTotal = pad(DATA_DOMAIN, 250);
  const geoTotal = pad(GEO_DOMAIN, 220);
  const N = gens.reduce((a, g) => a + g.n, 0);
  const targets = tierTargets(N);
  const remaining = targets.slice();
  const blocks = [];
  for (const g of gens) {
    const per = [0, 0, 0, 0, 0];
    for (let k = 0; k < g.n; k++) {
      let best = -1;
      let bestScore = -1;
      for (let t = 0; t < 5; t++) {
        if (remaining[t] <= 0 || targets[t] === 0) continue;
        const score = remaining[t] / targets[t];
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
      if (best < 0) throw new Error('tier allocation exhausted');
      per[best]++;
      remaining[best]--;
    }
    for (let t = 0; t < 5; t++) if (per[t] > 0) blocks.push({ g, tier: t, n: per[t] });
  }
  return { blocks, N, dataTotal, geoTotal, targets };
}

/* ================================================================== *
 * 9. Generation + independent verification
 * ================================================================== */

function sigOf(item) {
  return item.stem.replace(/\s+/g, ' ') + '|' + item.answer;
}

export function generate(seed = SEED) {
  const plan = buildPlan();
  const r = new RNG(seed);
  const items = [];
  const metas = [];
  const sigs = new Set();
  const failures = [];

  const sprCapable = plan.blocks.filter((b) => b.g.spr).reduce((a, b) => a + b.n, 0);
  const sprTarget = Math.min(Math.round(0.3 * plan.N), sprCapable);
  let sprSeen = 0;
  let sprAssigned = 0;

  for (const block of plan.blocks) {
    for (let k = 0; k < block.n; k++) {
      let wantSpr = false;
      if (block.g.spr) {
        sprSeen++;
        const before = Math.floor(((sprSeen - 1) * sprTarget) / sprCapable);
        const after = Math.floor((sprSeen * sprTarget) / sprCapable);
        if (after > before) wantSpr = true;
      }

      let item = null;
      let meta = null;
      for (let attempt = 0; attempt < 50 && !item; attempt++) {
        const body = block.g.fn(r, block.tier);
        if (!body) continue;
        const built = assemble(r, block.g, block.tier, body, wantSpr);
        if (!built) {
          if (wantSpr) wantSpr = false; // answer not grid-able -> fall back to MCQ
          continue;
        }
        if (sigs.has(sigOf(built))) continue;
        sigs.add(sigOf(built));
        item = built;
        meta = { num: body.num, text: body.text };
      }
      if (!item) {
        failures.push(`${block.g.skill} / ${TIERS[block.tier]}`);
        continue;
      }
      if (item.type === 'spr') sprAssigned++;
      items.push({ id: 'DGGX-' + String(items.length + 1).padStart(4, '0'), ...item });
      metas.push(meta);
    }
  }

  const problems = verifyItems(items, metas);
  return { items, metas, plan, problems, failures, sprAssigned, sprTarget };
}

function close(a, b) {
  const tol = 1e-6 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tol;
}

export function verifyItems(items, metas) {
  const problems = [];
  items.forEach((it, idx) => {
    const meta = metas[idx] || {};
    const where = `${it.id} (${it.skill})`;
    const dollars = (it.stem.replace(/\\\$/g, '').match(/\$/g) || []).length;
    if (dollars % 2 !== 0) problems.push(`${where}: unbalanced $ delimiters in stem`);
    if (/\bNaN\b|\bundefined\b|\bInfinity\b/.test(JSON.stringify(it))) problems.push(`${where}: NaN/undefined/Infinity in item`);
    if (!it.stem || !it.explanation || !it.skill_note) problems.push(`${where}: missing prose field`);
    if (!Array.isArray(it.choices)) {
      if (it.type !== 'spr') problems.push(`${where}: spr item without type spr`);
      if (typeof it.answer !== 'string' || !it.answer.length) problems.push(`${where}: missing spr answer`);
      if (!Array.isArray(it.accepted_spr) || it.accepted_spr.length < 1) problems.push(`${where}: missing accepted_spr`);
      const v = parseVal(it.answer);
      if (Number.isNaN(v)) problems.push(`${where}: spr answer "${it.answer}" is not numeric`);
      else if (typeof meta.num === 'number' && !close(v, meta.num)) problems.push(`${where}: spr answer ${v} != computed ${meta.num}`);
      for (const alt of it.accepted_spr || []) {
        const av = parseVal(alt);
        if (Number.isNaN(av)) problems.push(`${where}: accepted_spr "${alt}" unreadable`);
        else if (typeof meta.num === 'number' && !close(av, meta.num)) problems.push(`${where}: accepted_spr "${alt}" != computed ${meta.num}`);
      }
      return;
    }
    if (it.type !== 'mcq') problems.push(`${where}: has choices but type is ${it.type}`);
    if (it.choices.length !== 4) problems.push(`${where}: ${it.choices.length} choices`);
    if (new Set(it.choices).size !== it.choices.length) problems.push(`${where}: duplicate choice text`);
    if (!('ABCD'.includes(it.answer)) || it.answer.length !== 1) problems.push(`${where}: bad answer letter`);
    if (!it.choice_notes || it.choice_notes.length !== 4) problems.push(`${where}: choice_notes length`);
    if (!it.error_tags || it.error_tags.length !== 4) problems.push(`${where}: error_tags length`);
    if (it.choice_notes && it.choice_notes.filter((n) => n === 'correct').length !== 1) problems.push(`${where}: choice_notes must mark one correct`);
    if (it.error_tags && it.error_tags.filter((t) => t === 'none').length !== 1) problems.push(`${where}: exactly one 'none' tag required`);
    const allowed = ['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none'];
    for (const t of it.error_tags || []) if (!allowed.includes(t)) problems.push(`${where}: bad error tag ${t}`);

    const keyIdx = 'ABCD'.indexOf(it.answer);
    const keyed = it.choices[keyIdx];
    const bare = (s) => String(s).replace(/^\$/, '').replace(/\$$/, '');
    if (bare(keyed) !== bare(meta.text)) problems.push(`${where}: keyed choice "${keyed}" != computed text "${meta.text}"`);

    if (typeof meta.num === 'number') {
      const keyVal = parseVal(keyed);
      if (Number.isNaN(keyVal)) problems.push(`${where}: keyed choice "${keyed}" not parseable`);
      else if (!close(keyVal, meta.num)) problems.push(`${where}: keyed value ${keyVal} != computed ${meta.num}`);
      it.choices.forEach((c, i) => {
        if (i === keyIdx) return;
        const v = parseVal(c);
        if (!Number.isNaN(v) && close(v, meta.num)) problems.push(`${where}: distractor "${c}" also equals the answer`);
      });
    }
  });
  return problems;
}

/* ================================================================== *
 * 10. CLI
 * ================================================================== */

export function summary(result) {
  const items = result.items;
  const by = (fn) => {
    const m = {};
    for (const it of items) m[fn(it)] = (m[fn(it)] || 0) + 1;
    return m;
  };
  return {
    total: items.length,
    domains: by((i) => i.domain),
    difficulties: by((i) => i.difficulty),
    types: by((i) => i.type),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'math-data-geo.json');
  const result = generate(SEED);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ items: result.items }, null, 1) + '\n');
  const s = summary(result);
  console.log(`wrote ${out}`);
  console.log(`total ${s.total} | data ${s.domains[DATA_DOMAIN]} | geo ${s.domains[GEO_DOMAIN]}`);
  console.log('difficulty', JSON.stringify(s.difficulties));
  console.log('type', JSON.stringify(s.types));
  console.log(`failures ${result.failures.length}`);
  if (result.failures.length) console.log(result.failures.slice(0, 10).join('\n'));
  console.log(`verification problems: ${result.problems.length}`);
  if (result.problems.length) console.log(result.problems.slice(0, 25).join('\n'));
}
