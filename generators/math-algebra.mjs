// /Users/bala/SATPrep/generators/math-algebra.mjs
// Parametric Digital SAT Math generator — Algebra domain.
// Deterministic: mulberry32 PRNG only, never Math.random().
// Every item's answer is computed from the drawn parameters and independently
// re-checked before the item is accepted; failed draws return null and are redrawn.

export const SEED = 20261115;
export const DOMAIN = 'Algebra';

import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

/* ------------------------------------------------------------------ *
 * PRNG
 * ------------------------------------------------------------------ */

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(seed) {
    this._n = mulberry32(seed);
  }
  f() {
    return this._n();
  }
  int(a, b) {
    return a + Math.floor(this.f() * (b - a + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.f() * arr.length)];
  }
  chance(p) {
    return this.f() < p;
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/* ------------------------------------------------------------------ *
 * numbers / LaTeX
 * ------------------------------------------------------------------ */

const TOL = 1e-9;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const isInt = (n) => Math.abs(n - Math.round(n)) < 1e-7;
const eqv = (a, b) => Math.abs(a - b) < 1e-6;

function isNice(n) {
  if (!Number.isFinite(n)) return false;
  const r = round6(n);
  if (Math.abs(r) > 9999) return false;
  if (isInt(r)) return true;
  return Math.abs(r * 100 - Math.round(r * 100)) < 1e-6;
}

function fmt(n) {
  const r = round6(n);
  if (isInt(r)) return String(Math.round(r));
  return (Math.round(r * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// signed trailing term:  "+ 5" / "- 5"
function sgn(b) {
  if (b === 0) return '+ 0';
  return b > 0 ? `+ ${fmt(b)}` : `- ${fmt(Math.abs(b))}`;
}

// linear expression a*v + b
function lin(a, b, v = 'x') {
  let head;
  if (a === 0) return fmt(b);
  if (a === 1) head = v;
  else if (a === -1) head = '-' + v;
  else head = `${fmt(a)}${v}`;
  if (b === 0) return head;
  return `${head} ${b > 0 ? '+' : '-'} ${fmt(Math.abs(b))}`;
}

// parenthesize only negative values, for subtraction in explanations
function pn(n) {
  return n < 0 ? `(${fmt(n)})` : fmt(n);
}

// signed variable term: "+ 3y", "- y"
function yterm(k, v = 'y') {
  if (k === 1) return `+ ${v}`;
  if (k === -1) return `- ${v}`;
  return k > 0 ? `+ ${fmt(k)}${v}` : `- ${fmt(Math.abs(k))}${v}`;
}

const E = (v, note, tag) => ({ v, note, tag });
const C = (text, note, tag) => ({ text, note, tag });

/* ------------------------------------------------------------------ *
 * contexts
 * ------------------------------------------------------------------ */

const NAMES = ['Ava', 'Ben', 'Chloe', 'Diego', 'Elena', 'Farid', 'Grace', 'Hiro', 'Imani', 'Jonas', 'Keiko', 'Luis', 'Maya', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq'];

const MODEL_CTX = [
  {
    s: (x1, y1, x2, y2) => `A water tank is being drained at a constant rate. After $${x1}$ minutes it holds $${y1}$ gallons, and after $${x2}$ minutes it holds $${y2}$ gallons.`,
    q: (x3) => `How many gallons remain after $${x3}$ minutes?`,
    unit: 'gallons',
    per: 'minute',
  },
  {
    s: (x1, y1, x2, y2) => `A candle burns at a constant rate. It is $${y1}$ centimeters tall $${x1}$ hours after being lit and $${y2}$ centimeters tall $${x2}$ hours after being lit.`,
    q: (x3) => `How many centimeters tall is the candle $${x3}$ hours after being lit?`,
    unit: 'centimeters',
    per: 'hour',
  },
  {
    s: (x1, y1, x2, y2) => `A print shop charges a fixed setup fee plus a constant price per page. Printing $${x1}$ pages costs $${y1}$ dollars, and printing $${x2}$ pages costs $${y2}$ dollars.`,
    q: (x3) => `What is the charge, in dollars, for printing $${x3}$ pages?`,
    unit: 'dollars',
    per: 'page',
  },
  {
    s: (x1, y1, x2, y2) => `A hiker is walking toward a lookout point at a steady pace. She is $${y1}$ kilometers from the lookout after $${x1}$ hours and $${y2}$ kilometers from it after $${x2}$ hours.`,
    q: (x3) => `How many kilometers from the lookout is she after $${x3}$ hours?`,
    unit: 'kilometers',
    per: 'hour',
  },
];

const PLAN_CTX = [
  { s: (m, b) => `A cell phone plan charges a flat monthly fee of $${b}$ dollars plus $${m}$ dollars for each gigabyte of data used.`, unit: 'gigabyte', fixed: 'monthly fee' },
  { s: (m, b) => `A gym charges a one-time registration fee of $${b}$ dollars plus $${m}$ dollars for each class attended.`, unit: 'class', fixed: 'registration fee' },
  { s: (m, b) => `A bike rental shop charges a flat rental fee of $${b}$ dollars plus $${m}$ dollars for each hour of riding.`, unit: 'hour', fixed: 'rental fee' },
  { s: (m, b) => `A community pool charges a membership fee of $${b}$ dollars plus $${m}$ dollars for each visit.`, unit: 'visit', fixed: 'membership fee' },
  { s: (m, b) => `A streaming service charges a base subscription of $${b}$ dollars plus $${m}$ dollars for each premium channel added.`, unit: 'premium channel', fixed: 'base subscription' },
  { s: (m, b) => `A catering company charges a delivery fee of $${b}$ dollars plus $${m}$ dollars for each guest served.`, unit: 'guest', fixed: 'delivery fee' },
  { s: (m, b) => `A taxi company charges a base fare of $${b}$ dollars plus $${m}$ dollars for each mile traveled.`, unit: 'mile', fixed: 'base fare' },
  { s: (m, b) => `A shipping company charges a flat handling fee of $${b}$ dollars plus $${m}$ dollars for each box shipped.`, unit: 'box', fixed: 'handling fee' },
];

/* ------------------------------------------------------------------ *
 * 1. Linear equations in one variable
 * ------------------------------------------------------------------ */

function gLinearOne(rng, diff, type) {
  if (diff === 'easy') {
    const a = rng.int(2, 9);
    const x0 = rng.int(2, 12);
    let b = rng.int(-9, 9);
    if (b === 0) b = rng.pick([-7, -5, -3, 3, 5, 7]);
    const c = a * x0 + b;
    if (!eqv(a * x0 + b, c)) return null;
    return {
      stem: `If $${a}x ${sgn(b)} = ${c}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((c + b) / a, `added $${fmt(b)}$ to both sides instead of subtracting it`, 'sign'),
        E(c - b, `subtracted $${fmt(b)}$ but never divided by $${a}$`, 'algebra'),
        E(c / a - b, `divided by $${a}$ before undoing the constant`, 'algebra'),
        E(-x0, `made a sign error while isolating $x$`, 'sign'),
      ],
      explanation: `${b > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(b))}$ ${b > 0 ? 'from' : 'to'} both sides: $${a}x = ${c - b}$. Divide both sides by $${a}$ to get $x = ${x0}$.`,
      desmos: `${a}x ${sgn(b)} = ${c}`,
      skill_note: 'One inverse operation at a time; the trap is changing the sign of the constant when it crosses the equals sign.',
      check: `Substituted back: $${a}(${x0}) ${sgn(b)} = ${c}$, matching the right-hand side.`,
      tagline: 'algebra',
    };
  }

  if (diff === 'medium') {
    const a = rng.int(2, 7);
    let b = rng.int(-7, 7);
    if (b === 0) b = 4;
    const x0 = rng.int(-5, 10);
    const c = a * (x0 + b);
    return {
      stem: `If $${a}(${lin(1, b)}) = ${c}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((c - b) / a, `distributed $${a}$ to $x$ but not to $${fmt(b)}$`, 'algebra'),
        E(c / a + b, `added $${fmt(b)}$ after dividing instead of subtracting it`, 'sign'),
        E(c - b, `divided by $${a}$ only after subtracting, then stopped`, 'algebra'),
        E(-x0, `reversed the sign of the whole expression`, 'sign'),
      ],
      explanation: `Divide both sides by $${a}$: $${lin(1, b)} = ${c / a}$. Then ${b > 0 ? 'subtract' : 'add'} $${fmt(Math.abs(b))}$ to get $x = ${x0}$. Distribution would also work: $${a}x ${sgn(a * b)} = ${c}$.`,
      desmos: `${a}(${lin(1, b)}) = ${c}`,
      skill_note: 'Dividing first is faster than distributing; the trap is distributing the coefficient to the variable only.',
      check: `Substituted $x = ${x0}$: $${x0} ${sgn(b)} = ${x0 + b}$, and $${a}(${x0 + b}) = ${c}$.`,
      tagline: 'algebra',
    };
  }

  if (diff === 'hard') {
    const a = rng.int(3, 7);
    let c = rng.int(1, 6);
    if (c === a) c = a - 1;
    const x0 = rng.int(-5, 8);
    let b = rng.int(-6, 6);
    if (b === 0) b = 3;
    const d = a * (x0 + b) - c * x0;
    return {
      stem: `If $${a}(${lin(1, b)}) = ${lin(c, 0)} ${sgn(d)}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((d - b) / (a - c), `distributed $${a}$ to $x$ but not to $${fmt(b)}$`, 'algebra'),
        E((d + a * b) / (a - c), `used $${fmt(-b)}$ inside the parentheses when distributing`, 'sign'),
        E((d - b) / (a + c), `added the $x$-coefficients instead of subtracting them`, 'algebra'),
        E((d - a * b) / (a - c), `subtracted $${fmt(a * b)}$ instead of adding it when distributing`, 'sign'),
      ],
      explanation: `Distribute: $${a}x ${sgn(a * b)} = ${lin(c, 0)} ${sgn(d)}$. Collect $x$ on one side: $${lin(a - c, 0)} = ${d - a * b}$, so $x = ${x0}$.`,
      desmos: `${a}(${lin(1, b)}) = ${c}x ${sgn(d)}`,
      skill_note: 'Distribution must hit both terms; the classic error is leaving the constant undistributed.',
      check: `Left side at $x = ${x0}$ is $${a}(${x0 + b}) = ${a * (x0 + b)}$; right side is $${c}(${x0}) ${sgn(d)} = ${c * x0 + d}$.`,
      tagline: 'algebra',
    };
  }

  // very_hard / extreme: nested distribution
  for (let t = 0; t < 400; t++) {
    const a = rng.int(2, 4);
    const b = rng.int(2, 5);
    let cc = rng.int(-6, 6);
    if (cc === 0) cc = 3;
    const dd = rng.int(2, 4);
    const e = rng.int(2, 5);
    const x0 = rng.int(-4, 6);
    const fNum = a * (b * x0 + cc);
    if (fNum % dd !== 0) continue;
    const f = fNum / dd - e * x0;
    if (!Number.isInteger(f)) continue;
    const A = a * b;
    const B = dd * e;
    if (A === B) continue;
    return {
      stem: `If $${a}(${lin(b, cc)}) = ${dd}(${lin(e, f)})$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((dd * f - a * cc) / (A - B), `distributed $${a}$ to $${b}x$ but left $${fmt(cc)}$ undistributed`, 'algebra'),
        E((dd * f + a * cc) / (A - B), `used $${fmt(-cc)}$ as the constant after distributing`, 'sign'),
        E((dd * f - a * cc) / (A + B), `added the $x$-coefficients instead of subtracting`, 'algebra'),
        E((a * cc - dd * f) / (A - B), `reversed the order of subtraction when collecting terms`, 'sign'),
      ],
      explanation: `Distribute both sides: $${A}x ${sgn(a * cc)} = ${B}x ${sgn(dd * f)}$. Then $${A - B}x = ${dd * f - a * cc}$, so $x = ${x0}$.`,
      desmos: `${a}(${lin(b, cc)}) = ${dd}(${lin(e, f)})`,
      skill_note: 'Two distributions happen at once; keep the sign of each constant attached to its term.',
      check: `At $x = ${x0}$: left $= ${a}(${b * x0 + cc}) = ${a * (b * x0 + cc)}$ and right $= ${dd}(${e * x0 + f}) = ${dd * (e * x0 + f)}$.`,
      tagline: 'algebra',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 2. Distribution
 * ------------------------------------------------------------------ */

function gDistribute(rng, diff, type) {
  for (let t = 0; t < 200; t++) {
    const a = rng.int(2, 5);
    const b = rng.int(2, 4);
    let c = rng.int(-6, 6);
    if (c === 0) c = 4;
    const dd = rng.int(2, 5);
    let e = rng.int(-4, 4);
    if (e === 0) e = 2;
    const x0 = diff === 'easy' ? rng.int(1, 8) : rng.int(-5, 8);
    const f = a * (b * x0 + c) - dd * (x0 + e);
    const A = a * b - dd;
    if (A === 0) continue;
    if (diff === 'easy' && Math.abs(f) > 120) continue;
    return {
      stem: `If $${a}(${lin(b, c)}) - ${dd}(${lin(1, e)}) = ${f}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((f - c + e) / A, `distributed $${a}$ only to $${b}x$ and $${dd}$ only to $x$`, 'algebra'),
        E((f - a * c - dd * e) / A, `wrote $${sgn(-dd * e)}$ instead of $${sgn(dd * e)}$ after distributing`, 'sign'),
        E((f - a * c + dd * e) / (a * b + dd), `added $${a * b}$ and $${dd}$ instead of subtracting`, 'algebra'),
        E((f + a * c + dd * e) / A, `moved both constants without changing their signs`, 'sign'),
      ],
      explanation: `Distribute: $${a * b}x ${sgn(a * c)} ${yterm(-dd, 'x')} ${sgn(-dd * e)} = ${f}$. Combine like terms: $${lin(A, 0)} ${sgn(a * c - dd * e)} = ${f}$, so $x = ${x0}$.`,
      desmos: `${a}(${lin(b, c)}) - ${dd}(${lin(1, e)}) = ${f}`,
      skill_note: 'The minus sign in front of the second parenthesis flips every sign inside it.',
      check: `Substituted $x = ${x0}$: $${a}(${b * x0 + c}) - ${dd}(${x0 + e}) = ${a * (b * x0 + c)} - ${dd * (x0 + e)} = ${f}$.`,
      tagline: 'sign',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 3. Fractions
 * ------------------------------------------------------------------ */

function gFractions(rng, diff, type) {
  if (diff === 'easy') {
    const a = rng.int(2, 6);
    const t = rng.int(2, 9);
    const b = rng.int(1, 9);
    const x0 = a * t;
    const c = t + b;
    return {
      stem: `If $\\frac{x}{${a}} + ${b} = ${c}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((c - b) / a, `divided by $${a}$ instead of multiplying`, 'algebra'),
        E(a * c + b, `multiplied by $${a}$ before subtracting $${b}$`, 'algebra'),
        E(c - b, `subtracted $${b}$ but never cleared the denominator`, 'algebra'),
        E(-x0, `made a sign error when clearing the fraction`, 'sign'),
      ],
      explanation: `Subtract $${b}$: $\\frac{x}{${a}} = ${t}$. Multiply both sides by $${a}$: $x = ${x0}$.`,
      desmos: `x/${a} + ${b} = ${c}`,
      skill_note: 'Undo the addition before clearing the denominator; dividing first loses the scale factor.',
      check: `Substituted $x = ${x0}$: $\\frac{${x0}}{${a}} + ${b} = ${t} + ${b} = ${c}$.`,
      tagline: 'algebra',
    };
  }

  if (diff === 'medium') {
    const a = rng.int(2, 6);
    let b = rng.int(-8, 8);
    if (b === 0) b = 3;
    const c = rng.int(2, 9);
    const x0 = a * c - b;
    return {
      stem: `If $\\frac{${lin(1, b)}}{${a}} = ${c}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E(a * c + b, `added $${fmt(b)}$ instead of subtracting it after multiplying`, 'sign'),
        E(c / a - b, `divided by $${a}$ instead of multiplying`, 'algebra'),
        E(a * (c - b), `multiplied by $${a}$ before undoing $${sgn(b)}$`, 'algebra'),
        E(-x0, `sign error when clearing the fraction`, 'sign'),
      ],
      explanation: `Multiply both sides by $${a}$: $${lin(1, b)} = ${a * c}$. ${b > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(b))}$ to get $x = ${x0}$.`,
      desmos: `(x ${sgn(b)})/${a} = ${c}`,
      skill_note: 'Multiply out of the denominator first; adding the constant in the wrong direction is the usual slip.',
      check: `Substituted $x = ${x0}$: numerator $= ${x0 + b}$, and $\\frac{${x0 + b}}{${a}} = ${c}$.`,
      tagline: 'algebra',
    };
  }

  if (diff === 'hard') {
    for (let t = 0; t < 300; t++) {
      const a = rng.int(2, 6);
      let b = rng.int(-9, 9);
      if (b === 0) b = 4;
      const c = rng.int(2, 5);
      const x0 = rng.int(-4, 7);
      const n = a * x0 + b;
      if (n % c !== 0) continue;
      const d = n / c;
      return {
        stem: `If $\\frac{${lin(a, b)}}{${c}} = ${d}$, what is the value of $x$?`,
        answer: x0,
        distractors: [
          E((c * d + b) / a, `added $${fmt(b)}$ instead of subtracting it`, 'sign'),
          E(c * d - b, `multiplied by $${c}$ but never divided by $${a}$`, 'algebra'),
          E((d - b) / a, `multiplied by $${c}$ only on the numerator's variable term`, 'algebra'),
          E(-x0, `sign error while isolating $x$`, 'sign'),
        ],
        explanation: `Multiply both sides by $${c}$: $${lin(a, b)} = ${c * d}$. Then $${a}x = ${c * d - b}$, so $x = ${x0}$.`,
        desmos: `(${a}x ${sgn(b)})/${c} = ${d}`,
        skill_note: 'Clear the denominator before moving the constant; the coefficient $a$ still has to be divided out.',
        check: `Substituted $x = ${x0}$: $${a}(${x0}) ${sgn(b)} = ${n}$, and $\\frac{${n}}{${c}} = ${d}$.`,
        tagline: 'algebra',
      };
    }
    return null;
  }

  // very_hard / extreme: fraction equals fraction
  for (let t = 0; t < 500; t++) {
    const a = rng.int(2, 5);
    let b = rng.int(-7, 7);
    if (b === 0) b = 2;
    const c = rng.int(2, 5);
    const d = rng.int(2, 4);
    const f = rng.int(2, 5);
    const x0 = rng.int(-3, 6);
    const eNum = f * (a * x0 + b);
    if (eNum % c !== 0) continue;
    const e = eNum / c - d * x0;
    if (!Number.isInteger(e)) continue;
    const A = f * a - c * d;
    if (A === 0) continue;
    return {
      stem: `If $\\frac{${lin(a, b)}}{${c}} = \\frac{${lin(d, e)}}{${f}}$, what is the value of $x$?`,
      answer: x0,
      distractors: [
        E((c * e - f * b) / A, `cross-multiplied correctly but then moved the constant without changing sign`, 'sign'),
        E((c * e + f * b) / A, `used $${fmt(-b)}$ in the cross multiplication`, 'sign'),
        E((f * b - c * e) / A, `reversed the order of subtraction`, 'algebra'),
        E((c * e - f * b) / (f * a + c * d), `added the $x$-coefficients instead of subtracting`, 'algebra'),
      ],
      explanation: `Cross multiply: $${f}(${lin(a, b)}) = ${c}(${lin(d, e)})$. This gives $${f * a}x ${sgn(f * b)} = ${c * d}x ${sgn(c * e)}$, so $${A}x = ${c * e - f * b}$ and $x = ${x0}$.`,
      desmos: `(${a}x ${sgn(b)})/${c} = (${d}x ${sgn(e)})/${f}`,
      skill_note: 'Cross multiplication is just multiplying by both denominators; keep parentheses around each numerator.',
      check: `At $x = ${x0}$: left numerator $= ${a * x0 + b}$ and right numerator $= ${d * x0 + e}$; the two fractions both equal ${(a * x0 + b) / c}.`,
      tagline: 'algebra',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 4. Linear inequalities (sign flip)
 * ------------------------------------------------------------------ */

function gInequality(rng, diff, type) {
  if (diff === 'easy' || diff === 'medium') {
    let a = rng.int(2, 9);
    if (diff !== 'easy' && rng.chance(0.5)) a = -a;
    const k = rng.int(-7, 8);
    let b = rng.int(-9, 9);
    if (b === 0) b = 5;
    const c = a * k + b;
    const flip = a < 0;
    if (type === 'spr') {
      const askSmallest = a > 0;
      const ans = askSmallest ? k + 1 : k - 1;
      const holds = askSmallest ? a * ans + b > c : a * ans + b > c;
      if (!holds) return null;
      return {
        stem: `What is the ${askSmallest ? 'smallest' : 'greatest'} integer value of $x$ that satisfies $${a}x ${sgn(b)} > ${c}$?`,
        answer: ans,
        explanation: `${a > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(b))}$ ${a > 0 ? 'from' : 'to'} both sides: $${a}x > ${a * k}$. ${flip ? `Dividing by $${a}$ reverses the inequality, so $x < ${k}$.` : `Dividing by $${a}$ keeps the direction, so $x > ${k}$.`} The ${askSmallest ? 'smallest' : 'greatest'} integer ${askSmallest ? 'above' : 'below'} $${k}$ is $${ans}$.`,
        desmos: `${a}x ${sgn(b)} > ${c}`,
        skill_note: 'Dividing by a negative reverses the inequality symbol; then pick the nearest integer strictly inside the ray.',
        check: `Checked the boundary: $${a}(${ans}) ${sgn(b)} = ${a * ans + b}$ satisfies $> ${c}$, while $${a}(${askSmallest ? ans - 1 : ans + 1}) ${sgn(b)} = ${a * (askSmallest ? ans - 1 : ans + 1) + b}$ does not.`,
      };
    }
    const cands = [
      C(`$x > ${k}$`, flip ? `divided by $${a}$ without reversing the inequality` : 'correct', flip ? 'concept' : 'none'),
      C(`$x < ${k}$`, flip ? 'correct' : `reversed the inequality without dividing by a negative`, flip ? 'none' : 'concept'),
      C(`$x \\ge ${k}$`, `kept the boundary point even though the inequality is strict`, 'concept'),
      C(`$x \\le ${k}$`, `used the wrong direction and kept the boundary point`, 'concept'),
      C(`$x > ${-k}$`, `changed the sign of the boundary instead of the symbol`, 'sign'),
    ];
    return {
      stem: `Which of the following describes all values of $x$ that satisfy $${a}x ${sgn(b)} > ${c}$?`,
      choices: cands,
      explanation: `${a > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(b))}$ ${a > 0 ? 'from' : 'to'} both sides to get $${a}x > ${a * k}$. Dividing by $${a}$ ${flip ? 'reverses' : 'preserves'} the inequality, so $x ${flip ? '<' : '>'} ${k}$.`,
      desmos: `${a}x ${sgn(b)} > ${c}`,
      skill_note: 'A negative coefficient flips the direction only at the division step, not when moving the constant.',
      check: `Tested $x = ${k + (flip ? -1 : 1)}$: $${a}(${k + (flip ? -1 : 1)}) ${sgn(b)} = ${a * (k + (flip ? -1 : 1)) + b}$, which ${a * (k + (flip ? -1 : 1)) + b > c ? 'satisfies' : 'fails'} the inequality.`,
      tagline: 'concept',
    };
  }

  // hard / very_hard / extreme: variable on both sides
  const a = rng.int(2, 6);
  const c = rng.int(1, 5);
  const k = rng.int(-6, 6);
  let b = rng.int(-8, 8);
  if (b === 0) b = 3;
  const d = b - k * (a + c);
  const kk = k;
  if (type === 'spr') {
    const ans = kk + 1;
    const lhs = -a * ans + b;
    const rhs = c * ans + d;
    if (!(lhs < rhs)) return null;
    return {
      stem: `What is the smallest integer value of $x$ that satisfies $${lin(-a, 0)} ${sgn(b)} < ${lin(c, 0)} ${sgn(d)}$?`,
      answer: ans,
      explanation: `Collect $x$ on the left: $${-(a + c)}x < ${d - b}$, so $x > ${kk}$ after dividing by a negative. The smallest integer greater than $${kk}$ is $${ans}$.`,
      desmos: `${-a}x ${sgn(b)} < ${c}x ${sgn(d)}`,
      skill_note: 'Move the smaller $x$-term to keep the coefficient positive when you can; otherwise remember the flip.',
      check: `At $x = ${ans}$: left $= ${lhs}$ and right $= ${rhs}$, so the inequality holds; at $x = ${ans - 1}$ it fails.`,
    };
  }
  const cands = [
    C(`$x > ${kk}$`, 'correct', 'none'),
    C(`$x < ${kk}$`, `divided by $${-(a + c)}$ without reversing the inequality`, 'concept'),
    C(`$x \\ge ${kk}$`, `left the boundary in even though the inequality is strict`, 'concept'),
    C(`$x < ${-kk}$`, `changed the sign of the boundary instead of the direction`, 'sign'),
  ];
  return {
    stem: `Which of the following describes all values of $x$ that satisfy $${lin(-a, 0)} ${sgn(b)} < ${lin(c, 0)} ${sgn(d)}$?`,
    choices: cands,
    explanation: `Subtract $${lin(c, 0)}$ from both sides: $${lin(-(a + c), 0)} ${sgn(b)} < ${d}$. Then $${lin(-(a + c), 0)} < ${d - b}$, and dividing by $${-(a + c)}$ reverses the symbol: $x > ${kk}$.`,
    desmos: `${-a}x ${sgn(b)} < ${c}x ${sgn(d)}`,
    skill_note: 'When both sides hold $x$, combine first; the flip happens exactly once, at the final division by a negative.',
    check: `At $x = ${kk + 1}$: $${-a * (kk + 1) + b} < ${c * (kk + 1) + d}$ holds; at $x = ${kk - 1}$ it fails.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 5. Compound inequalities
 * ------------------------------------------------------------------ */

function gCompound(rng, diff, type) {
  const b = rng.int(2, 5);
  const L = rng.int(-7, 2);
  const R = L + rng.int(3, 8);
  let c = rng.int(-7, 7);
  if (c === 0) c = 3;
  const A = b * L + c;
  const D = b * R + c;
  const count = R - L - 1;
  if (count <= 0) return null;
  if (type === 'spr') {
    let n = 0;
    for (let x = L - 2; x <= R + 2; x++) if (x > L && x < R) n++;
    if (n !== count) return null;
    return {
      stem: `How many integer values of $x$ satisfy $${A} < ${b}x ${sgn(c)} < ${D}$?`,
      answer: count,
      explanation: `${c > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(c))}$ ${c > 0 ? 'from' : 'to'} all three parts: $${A - c} < ${b}x < ${D - c}$. Divide by $${b}$: $${L} < x < ${R}$. The integers strictly between $${L}$ and $${R}$ are $${L + 1}$ through $${R - 1}$, which is $${count}$ values.`,
      desmos: `${A} < ${b}x ${sgn(c)} < ${D}`,
      skill_note: 'Apply the same operation to all three parts; count integers strictly between the endpoints.',
      check: `Enumerated every integer from $${L - 1}$ to $${R + 1}$ and exactly $${count}$ satisfy the compound inequality.`,
    };
  }
  const cands = [
    C(`$${L} < x < ${R}$`, 'correct', 'none'),
    C(`$${L} \\le x \\le ${R}$`, `used non-strict symbols even though both ends are strict`, 'concept'),
    C(`$x < ${L}$ or $x > ${R}$`, `described the outside of the interval instead of the inside`, 'concept'),
    C(`$${-R} < x < ${-L}$`, `negated both endpoints instead of dividing by $${b}$`, 'sign'),
  ];
  return {
    stem: `Which of the following describes all values of $x$ that satisfy $${A} < ${b}x ${sgn(c)} < ${D}$?`,
    choices: cands,
    explanation: `${c > 0 ? 'Subtract' : 'Add'} $${fmt(Math.abs(c))}$ ${c > 0 ? 'from' : 'to'} all three parts: $${A - c} < ${b}x < ${D - c}$. Divide by $${b}$: $${L} < x < ${R}$.`,
    desmos: `${A} < ${b}x ${sgn(c)} < ${D}`,
    skill_note: 'A compound inequality stays compound; the trap is turning the interval inside-out into two rays.',
    check: `Tested $x = ${L + 1}$ (inside, true) and $x = ${R + 1}$ (outside, false) in the original inequality.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 6. Absolute value equations
 * ------------------------------------------------------------------ */

function gAbsEq(rng, diff, type) {
  for (let t = 0; t < 200; t++) {
    const a = rng.int(2, 5);
    let r1 = rng.int(-7, 3);
    let r2 = r1 + rng.int(2, 7);
    if ((r1 + r2) % 2 !== 0) r2 += 1;
    const b = -a * ((r1 + r2) / 2);
    const c = (a * (r2 - r1)) / 2;
    if (c <= 0) continue;
    const ok1 = Math.abs(a * r1 + b) === c;
    const ok2 = Math.abs(a * r2 + b) === c;
    if (!ok1 || !ok2) continue;
    const askSum = type === 'spr' ? true : rng.chance(0.55);
    const ans = askSum ? r1 + r2 : r2;
    return {
      stem: askSum
        ? `What is the sum of all solutions to $|${a}x ${sgn(b)}| = ${c}$?`
        : `What is the greater solution to $|${a}x ${sgn(b)}| = ${c}$?`,
      answer: ans,
      distractors: askSum
        ? [
            E(r2, `gave only the positive solution`, 'concept'),
            E(r1, `gave only the negative solution`, 'concept'),
            E(-(r1 + r2), `dropped the sign of the sum`, 'sign'),
            E(r1 - r2, `subtracted the two solutions instead of adding`, 'concept'),
          ]
        : [
            E(r1, `gave the lesser solution`, 'concept'),
            E(-r2, `negated the solution after solving`, 'sign'),
            E(r1 + r2, `gave the sum of the solutions`, 'concept'),
            E(r2 - r1, `subtracted the two solutions instead of taking the greater one`, 'concept'),
          ],
      explanation: `Split into two cases: $${a}x ${sgn(b)} = ${c}$ gives $x = ${r2}$, and $${a}x ${sgn(b)} = ${-c}$ gives $x = ${r1}$. ${askSum ? `Their sum is $${pn(r1)} + ${pn(r2)} = ${r1 + r2}$.` : `The greater of the two is $${r2}$.`}`,
      desmos: `|${a}x ${sgn(b)}| = ${c}`,
      skill_note: 'An absolute value equation produces two cases; forgetting the negative case loses a solution.',
      check: `Checked both roots: $|${a}(${r1}) ${sgn(b)}| = ${Math.abs(a * r1 + b)}$ and $|${a}(${r2}) ${sgn(b)}| = ${Math.abs(a * r2 + b)}$, both equal $${c}$.`,
      tagline: 'concept',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 7. Absolute value inequalities
 * ------------------------------------------------------------------ */

function gAbsIneq(rng, diff, type) {
  const a = rng.int(2, 4);
  const m = rng.int(-4, 6);
  const h = rng.int(2, 6);
  const b = -a * m;
  const c = a * h;
  if (b === 0) return null;
  const lo = m - h;
  const hi = m + h;
  if (type === 'spr') {
    const ans = hi - 1;
    if (!(Math.abs(a * ans + b) < c)) return null;
    if (Math.abs(a * (ans + 1) + b) < c) return null;
    return {
      stem: `What is the greatest integer value of $x$ that satisfies $|${a}x ${sgn(b)}| < ${c}$?`,
      answer: ans,
      explanation: `Rewrite as $${-c} < ${a}x ${sgn(b)} < ${c}$, so $${lo} < x < ${hi}$. The greatest integer strictly less than $${hi}$ is $${ans}$.`,
      desmos: `|${a}x ${sgn(b)}| < ${c}`,
      skill_note: 'A "less than" absolute value becomes a single interval between two endpoints.',
      check: `Checked $|${a}(${ans}) ${sgn(b)}| = ${Math.abs(a * ans + b)} < ${c}$, while $x = ${ans + 1}$ gives $${Math.abs(a * (ans + 1) + b)}$, which is not less than $${c}$.`,
    };
  }
  const cands = [
    C(`$${lo} < x < ${hi}$`, 'correct', 'none'),
    C(`$${lo} \\le x \\le ${hi}$`, `kept the endpoints although the inequality is strict`, 'concept'),
    C(`$x < ${lo}$ or $x > ${hi}$`, `used the "greater than" pattern for a "less than" inequality`, 'concept'),
    C(`$${lo - h} < x < ${hi + h}$`, `divided by $${a}$ without also dividing the endpoints`, 'algebra'),
  ];
  return {
    stem: `Which of the following describes all values of $x$ that satisfy $|${a}x ${sgn(b)}| < ${c}$?`,
    choices: cands,
    explanation: `The inequality $|u| < ${c}$ means $${-c} < u < ${c}$, so $${-c} < ${a}x ${sgn(b)} < ${c}$. Subtract $${fmt(b)}$ and divide by $${a}$ to get $${lo} < x < ${hi}$.`,
    desmos: `|${a}x ${sgn(b)}| < ${c}`,
    skill_note: '"Less than" gives a bounded interval; the endpoints are excluded because the symbol is strict.',
    check: `Tested the midpoint $x = ${m}$ (true) and $x = ${hi}$ (false) in the original inequality.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 8. Slope from two points
 * ------------------------------------------------------------------ */

function gSlopePoints(rng, diff, type) {
  if (diff === 'easy' || diff === 'medium') {
    for (let t = 0; t < 300; t++) {
      const x1 = rng.int(-7, 3);
      const x2 = x1 + rng.int(2, 8);
      const y1 = rng.int(-8, 8);
      const y2 = rng.int(-8, 8);
      if (y2 === y1) continue;
      const m = (y2 - y1) / (x2 - x1);
      if (!isNice(m)) continue;
      const ok = eqv(m * (x2 - x1), y2 - y1);
      if (!ok) return null;
      return {
        stem: `What is the slope of the line that passes through the points $(${x1}, ${y1})$ and $(${x2}, ${y2})$?`,
        answer: m,
        distractors: [
          E(-m, `subtracted the coordinates in the opposite order in the numerator only`, 'sign'),
          E((x2 - x1) / (y2 - y1), `put the change in $x$ over the change in $y$`, 'concept'),
          E(-1 / m, `used the perpendicular slope instead of the slope`, 'concept'),
          E((y2 + y1) / (x2 - x1), `added the $y$-values instead of subtracting them`, 'arithmetic'),
        ],
        explanation: `Slope is $\\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${pn(y1)}}{${x2} - ${pn(x1)}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${fmt(m)}$. ${m > 0 ? `For every $1$ unit increase in $x$, $y$ increases by $${fmt(m)}$.` : m < 0 ? `For every $1$ unit increase in $x$, $y$ decreases by $${fmt(Math.abs(m))}$.` : 'The line is horizontal, so its slope is zero.'}`,
        desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
        skill_note: 'Keep the points in the same order in numerator and denominator; swapping one but not the other flips the sign.',
        check: `Verified $${fmt(m)} \\cdot (${x2 - x1}) = ${y2 - y1}$, so the rise over run matches both points.`,
        tagline: 'concept',
        tagline: 'concept',
      };
    }
    return null;
  }

  // hard+: one coordinate is unknown
  for (let t = 0; t < 300; t++) {
    const x1 = rng.int(-6, 2);
    const x2 = x1 + rng.int(2, 7);
    const y1 = rng.int(-7, 7);
    const m = rng.pick([2, 3, 4, -2, -3, 0.5, 1.5, -0.5]);
    const k = y1 + m * (x2 - x1);
    if (!isNice(k)) continue;
    return {
      stem: `The line passing through $(${x1}, ${y1})$ and $(${x2}, k)$ has slope $${fmt(m)}$. What is the value of $k$?`,
      answer: k,
      distractors: [
        E(y1 + m * x2, `added the slope times $x_2$ to $y_1$ instead of the horizontal change`, 'algebra'),
        E(y1 - m * (x2 - x1), `subtracted the rise instead of adding it`, 'sign'),
        E(y1 + m * (x2 + x1), `added the $x$-coordinates instead of subtracting`, 'algebra'),
        E(m * (x2 - x1), `forgot to add the starting $y$-value`, 'concept'),
      ],
      explanation: `The rise is $k - ${pn(y1)} = ${fmt(m)}(${x2} - ${pn(x1)}) = ${fmt(m * (x2 - x1))}$, so $k = ${y1} ${sgn(m * (x2 - x1))} = ${k}$. Each unit of horizontal change moves $y$ by $${fmt(m)}$.`,
      desmos: `(${x1}, ${y1}), (${x2}, ${k})`,
      skill_note: 'Slope times horizontal change gives the rise, which then has to be added to the known $y$-value.',
      check: `Recomputed the slope from $(${x1}, ${y1})$ to $(${x2}, ${k})$: $\\frac{${k} - (${y1})}{${x2 - x1}} = ${fmt(m)}$.`,
      tagline: 'algebra',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 9. Slope and intercept interpretation (conceptual)
 * ------------------------------------------------------------------ */

function gSlopeInterp(rng, diff, type) {
  const ctx = rng.pick(PLAN_CTX);
  const m = rng.pick([2, 3, 4, 5, 7, 8]);
  const b = rng.pick([12, 18, 20, 25, 30, 40, 45]);
  const cands = [
    C(`the cost of each additional ${ctx.unit}`, 'correct', 'none'),
    C(`the ${ctx.fixed}`, `described the constant term instead of the coefficient`, 'concept'),
    C(`the total cost for $${m}$ ${ctx.unit}s`, `multiplied the coefficient by itself instead of interpreting it as a rate`, 'concept'),
    C(`the number of ${ctx.unit}s that cost $${b}$ dollars`, `treated the coefficient as a count rather than a rate`, 'quantity'),
  ];
  return {
    stem: `${ctx.s(m, b)} The total cost $C$, in dollars, for $x$ ${ctx.unit}s is given by $C = ${m}x + ${b}$. What does $${m}$ represent in this model?`,
    choices: cands,
    explanation: `The coefficient of $x$ is the rate of change: each additional ${ctx.unit} raises the cost by $${m}$ dollars. The constant $${b}$ is the ${ctx.fixed}, charged even when $x = 0$.`,
    desmos: `y = ${m}x + ${b}`,
    skill_note: 'In $C = mx + b$, the coefficient of $x$ is the per-unit rate and the constant is the starting amount.',
    check: `Compared $C(0) = ${b}$ with $C(1) = ${m + b}$: the difference is $${m}$, confirming the coefficient is the per-${ctx.unit} charge.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 10. Linear model from two data points
 * ------------------------------------------------------------------ */

function gModelTwoPoints(rng, diff, type) {
  for (let t = 0; t < 400; t++) {
    const ctx = rng.pick(MODEL_CTX);
    const x1 = rng.int(2, 6);
    const x2 = x1 + rng.int(2, 5);
    const m = rng.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5]);
    const y1 = rng.int(30, 90);
    const y2 = y1 + m * (x2 - x1);
    if (y2 <= 0) continue;
    const x3 = x2 + rng.int(1, 4);
    const y3 = y1 + m * (x3 - x1);
    if (y3 <= 0 || y3 > 500) continue;
    const slope = (y2 - y1) / (x2 - x1);
    if (!eqv(slope, m)) continue;
    return {
      stem: `${ctx.s(x1, y1, x2, y2)} ${ctx.q(x3)}`,
      answer: y3,
      distractors: [
        E(y2 + m * (x3 - x2) * 2, `doubled the time interval instead of extending by $${x3 - x2}$`, 'quantity'),
        E(y1 + m * x3, `used $y = mx + b$ with $b = y_1$ instead of finding the intercept`, 'setup'),
        E(y2 + (x3 - x2), `added the extra time directly to the amount instead of multiplying by the rate`, 'concept'),
        E(y1 - m * (x3 - x1), `moved in the wrong direction from the first data point`, 'sign'),
      ],
      explanation: `The rate is $\\frac{${y2} - ${pn(y1)}}{${x2} - ${x1}} = ${m}$ ${ctx.unit} per ${ctx.per}. From the first data point, the value at input $x$ is $${y1} ${sgn(m)} (x - ${x1})$. At $x = ${x3}$ this is $${y1} ${sgn(m * (x3 - x1))} = ${y3}$.`,
      desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
      skill_note: 'Extend the pattern by multiplying the rate by the change in the input, not by adding the input difference.',
      check: `Recomputed from the second data point: $${y2} + ${pn(m)}(${x3 - x2}) = ${y3}$, matching the value from the first point.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 11. Equations of lines
 * ------------------------------------------------------------------ */

function gLineEq(rng, diff, type) {
  if (diff === 'easy' || diff === 'medium') {
    for (let t = 0; t < 300; t++) {
      const x1 = rng.int(-6, 3);
      const x2 = x1 + rng.int(2, 6);
      const m = rng.pick([2, 3, 4, -2, -3, 0.5, 1.5]);
      const y1 = rng.int(-8, 8);
      const y2 = y1 + m * (x2 - x1);
      if (!isNice(y2)) continue;
      const x3 = x2 + rng.int(1, 5);
      const y3 = y1 + m * (x3 - x1);
      if (!isNice(y3)) continue;
      return {
        stem: `A line passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is the value of $y$ on this line when $x = ${x3}$?`,
        answer: y3,
        distractors: [
          E(y2 + (x3 - x2), `added the horizontal change directly instead of multiplying by the slope`, 'concept'),
          E(y1 + m * (x3 + x1), `added the $x$-coordinates instead of subtracting`, 'algebra'),
          E(y1 - m * (x3 - x1), `moved in the opposite direction from the first point`, 'sign'),
          E(m * x3, `assumed the line passes through the origin`, 'setup'),
        ],
        explanation: `The slope is $\\frac{${y2} - ${pn(y1)}}{${x2} - ${pn(x1)}} = ${fmt(m)}$. Using point-slope from $(${x1}, ${y1})$: $y = ${y1} ${sgn(m)} (x - ${pn(x1)})$. At $x = ${x3}$, $y = ${y1} ${sgn(m * (x3 - x1))} = ${y3}$.`,
        desmos: `y = ${fmt(m)}(x - ${x1}) + ${y1}`,
        skill_note: 'Point-slope keeps the starting point attached; substituting the new $x$ must not disturb the slope.',
        check: `Both points satisfy the model: at $x = ${x2}$, $y = ${y2}$; at $x = ${x3}$, $y = ${y3}$.`,
        tagline: 'algebra',
      };
    }
    return null;
  }

  // hard+: identify the equation from two points
  for (let t = 0; t < 300; t++) {
    const x1 = rng.int(-5, 2);
    const x2 = x1 + rng.int(1, 5);
    const m = rng.pick([2, 3, -2, -3, 0.5, 1.5, -0.5]);
    const y1 = rng.int(-8, 8);
    const y2 = y1 + m * (x2 - x1);
    const k = y1 - m * x1;
    if (!isNice(k) || !isNice(y2)) continue;
    if (type === 'spr') {
      return {
        stem: `A line passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is the $y$-intercept of this line?`,
        answer: k,
        distractors: [
          E(y1, `used $y_1$ as the intercept without adjusting for the slope`, 'setup'),
          E(-k, `sign error when solving for the intercept`, 'sign'),
          E(y1 + m * x1, `added $m x_1$ instead of subtracting it`, 'sign'),
          E(y2, `used the second $y$-value as the intercept`, 'concept'),
        ],
        explanation: `The slope is $\\frac{${y2} - ${pn(y1)}}{${x2} - ${pn(x1)}} = ${fmt(m)}$. Substituting $(${x1}, ${y1})$ into $y = mx + b$ gives $${fmt(m)}(${x1}) + b = ${y1}$, so $b = ${k}$.`,
        desmos: `y = ${fmt(m)}(x - ${pn(x1)}) + ${y1}`,
        skill_note: 'The intercept is not one of the data values unless $x = 0$ appears in the data.',
        check: `Checked that $(${x1}, ${y1})$ satisfies $y = ${fmt(m)}x ${sgn(k)}$: $${fmt(m * x1 + k)} = ${y1}$.`,
        tagline: 'setup',
      };
    }
    const opts = [
      C(`$y = ${fmt(m)}x ${sgn(k)}$`, 'correct', 'none'),
      C(`$y = ${fmt(m)}x ${sgn(-k)}$`, `used $y_1$ as the intercept without adjusting for the slope`, 'setup'),
      C(`$y = ${fmt(-m)}x ${sgn(k)}$`, `computed the slope with the coordinates in inconsistent order`, 'sign'),
      C(`$y = ${fmt(k)}x ${sgn(m)}$`, `swapped the slope and the intercept`, 'concept'),
    ];
    const texts = new Set(opts.map((o) => o.text));
    if (texts.size !== 4) continue;
    return {
      stem: `Which equation represents the line that passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$?`,
      choices: opts,
      explanation: `Slope $= \\frac{${y2} - ${pn(y1)}}{${x2} - ${pn(x1)}} = ${fmt(m)}$. Substituting $(${x1}, ${y1})$ gives $${fmt(m)}(${x1}) + b = ${y1}$, so the intercept is $${fmt(k)}$ and $y = ${fmt(m)}x ${sgn(k)}$.`,
      desmos: `y = ${fmt(m)}x ${sgn(k)}`,
      skill_note: 'Finding the slope is only half the job; the intercept must be recomputed, not copied from a data point.',
      check: `Evaluated the chosen equation at both points: $x = ${x1}$ gives $${y1}$ and $x = ${x2}$ gives $${y2}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 12. Parallel and perpendicular lines
 * ------------------------------------------------------------------ */

function gParallelPerp(rng, diff, type) {
  for (let t = 0; t < 300; t++) {
    const a = rng.int(2, 6);
    const b = a * rng.int(2, 4);
    const c = rng.int(3, 24);
    const mGiven = -a / b;
    const perp = b / a;
    if (!isNice(perp)) continue;
    if (diff === 'easy' || diff === 'medium') {
      const line = `${a}x ${sgn(b)}y = ${c}`;
      return {
        stem: `What is the slope of the line that is perpendicular to the line $${a}x ${sgn(b)}y = ${c}$?`,
        answer: perp,
        distractors: [
          E(mGiven, `gave the slope of the given line, not the perpendicular`, 'concept'),
          E(-b / a, `flipped the sign but not the ratio`, 'sign'),
          E(a / b, `used the coefficient ratio with the wrong sign`, 'concept'),
          E(c / b, `read the $y$-intercept as the slope`, 'setup'),
        ],
        explanation: `Rewrite in slope-intercept form: $y = ${fmt(mGiven)}x ${sgn(c / b)}$, so the given slope is $${fmt(mGiven)}$. A perpendicular slope is the negative reciprocal: $${fmt(perp)}$.`,
        desmos: `${a}x ${sgn(b)}y = ${c}`,
        skill_note: 'Perpendicular means negative reciprocal; parallel would mean the same slope.',
        check: `Multiplied the two slopes: $${fmt(mGiven)} \\cdot ${fmt(perp)} = -1$.`,
        tagline: 'concept',
      };
    }
    const px = rng.int(-5, 4);
    const py = rng.int(-6, 8);
    const k = py - mGiven * px;
    if (!isNice(k)) continue;
    return {
      stem: `The line $\\ell$ is parallel to $${a}x ${sgn(b)}y = ${c}$ and passes through $(${px}, ${py})$. What is the $y$-intercept of $\\ell$?`,
      answer: k,
      distractors: [
        E(py + mGiven * px, `added the slope times the $x$-coordinate instead of subtracting it`, 'sign'),
        E(perp * px - py, `used the perpendicular slope instead of the parallel slope`, 'concept'),
        E(py, `assumed a parallel line must have the same intercept`, 'setup'),
        E(c / b, `used the intercept of the original line`, 'setup'),
      ],
      explanation: `The given line has slope $${fmt(mGiven)}$. A parallel line shares that slope, so substituting the point gives $${fmt(mGiven)}(${px}) + b = ${py}$, which means $b = ${fmt(k)}$.`,
      desmos: `y = ${fmt(mGiven)}(x - ${px}) + ${py}`,
      skill_note: 'Parallel lines share a slope but not an intercept; substitute the point to find the new intercept.',
      check: `Checked that $(${px}, ${py})$ satisfies $y = ${fmt(mGiven)}x ${sgn(k)}$: $${fmt(mGiven * px + k)} = ${py}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 13. Systems of two linear equations
 * ------------------------------------------------------------------ */

function gSystem(rng, diff, type) {
  for (let t = 0; t < 300; t++) {
    const x0 = rng.int(-6, 8);
    const y0 = rng.int(-6, 8);
    const a = rng.int(1, 6);
    let b = rng.int(-6, 6);
    if (b === 0) b = 2;
    const c = rng.int(1, 6);
    let d = rng.int(-6, 6);
    if (d === 0) d = 3;
    const det = a * d - b * c;
    if (det === 0) continue;
    const e = a * x0 + b * y0;
    const f = c * x0 + d * y0;
    const ask = type === 'spr' ? rng.pick(['x', 'y', 'sum']) : rng.pick(['x', 'y', 'sum']);
    const ans = ask === 'x' ? x0 : ask === 'y' ? y0 : x0 + y0;
    const label = ask === 'sum' ? 'x + y' : ask;
    return {
      stem: `If $${lin(a, 0)} ${yterm(b)} = ${e}$ and $${lin(c, 0)} ${yterm(d)} = ${f}$, what is the value of $${label}$?`,
      answer: ans,
      distractors: [
        E((e * d + b * f) / det, `added the products instead of subtracting in the numerator`, 'sign'),
        E((e * d - b * f) / (a * d + b * c), `used $ad + bc$ in the denominator`, 'algebra'),
        E(ask === 'x' ? y0 : x0, `solved for the other variable`, 'concept'),
        E(ask === 'sum' ? x0 - y0 : -(ask === 'x' ? x0 : y0), `made a sign error during elimination`, 'sign'),
      ],
      explanation: `Elimination: multiply the first equation by $${c}$ and the second by $${a}$, then subtract to eliminate $x$. This gives $y = ${y0}$ and back-substitution gives $x = ${x0}$.${ask === 'sum' ? ` So $x + y = ${x0 + y0}$.` : ''}`,
      desmos: `${a}x ${sgn(b)}y = ${e}, ${c}x ${sgn(d)}y = ${f}`,
      skill_note: 'Elimination must scale both sides of an equation; back-substitute to recover the other variable.',
      check: `Substituted $(${x0}, ${y0})$ into both equations: $${a * x0 + b * y0} = ${e}$ and $${c * x0 + d * y0} = ${f}$.`,
      tagline: 'algebra',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 14. Systems word problems
 * ------------------------------------------------------------------ */

function gSystemWord(rng, diff, type) {
  const kind = rng.pick(['tickets', 'mixture', 'labor']);

  if (kind === 'tickets') {
    const priceA = rng.int(8, 15);
    const priceC = rng.int(3, 7);
    const adult = rng.int(10, 40);
    const child = rng.int(6, 25);
    const total = adult + child;
    const revenue = priceA * adult + priceC * child;
    if (priceA * adult + priceC * child !== revenue) return null;
    return {
      stem: `At a school play, adult tickets cost $${priceA}$ dollars each and child tickets cost $${priceC}$ dollars each. A total of $${total}$ tickets were sold for $${revenue}$ dollars. How many adult tickets were sold?`,
      answer: adult,
      distractors: [
        E(child, `solved for child tickets instead of adult tickets`, 'concept'),
        E(adult + 2, `rounded an elimination step instead of finishing it`, 'arithmetic'),
        E(total / 2, `assumed the tickets split evenly`, 'setup'),
        E(revenue / priceA, `divided total revenue by the adult price only`, 'setup'),
      ],
      explanation: `Let $a$ be adult tickets. Then $${priceA}a + ${priceC}(${total} - a) = ${revenue}$, which simplifies to $${priceA - priceC}a = ${revenue - priceC * total}$. So $a = ${adult}$.`,
      desmos: `${priceA}a + ${priceC}c = ${revenue}, a + c = ${total}`,
      skill_note: 'Two unknowns need two equations: the count equation and the money equation.',
      check: `Checked both equations: $${adult} + ${child} = ${total}$ and $${priceA}(${adult}) + ${priceC}(${child}) = ${revenue}$.`,
      tagline: 'setup',
    };
  }

  if (kind === 'mixture') {
    for (let t = 0; t < 300; t++) {
      const p1 = rng.pick([10, 15, 20, 25]);
      const p2 = rng.pick([40, 50, 60, 70]);
      const conc = rng.pick([30, 35, 40, 45]);
      if (!(p1 < conc && conc < p2)) continue;
      const v2 = rng.int(2, 12);
      const num = v2 * (conc - p2);
      const den = p1 - conc;
      if (num % den !== 0) continue;
      const v1 = num / den;
      if (v1 <= 0 || v1 > 60) continue;
      if ((p1 * v1 + p2 * v2) !== conc * (v1 + v2)) continue;
      return {
        stem: `A lab technician has a solution that is $${p1}$ percent acid and another that is $${p2}$ percent acid. How many liters of the $${p1}$ percent solution must be mixed with $${v2}$ liters of the $${p2}$ percent solution to obtain a mixture that is $${conc}$ percent acid?`,
        answer: v1,
        distractors: [
          E(v2, `used the same volume for both solutions`, 'setup'),
          E((v2 * (p2 - conc)) / (conc - p1), `set up the ratio of concentration differences upside down`, 'setup'),
          E((p2 * v2) / p1, `divided the acid amounts instead of comparing to the target concentration`, 'algebra'),
          E(v1 + v2, `gave the total volume of the mixture instead of the volume added`, 'quantity'),
        ],
        explanation: `Acid in = acid out: $${p1}v + ${p2}(${v2}) = ${conc}(v + ${v2})$. Collecting the volumes gives $${p1 - conc}v = ${conc - p2}(${v2})$, so $v = ${v1}$.`,
        desmos: `${p1}v + ${p2}(${v2}) = ${conc}(v + ${v2})`,
        skill_note: 'Track the amount of pure acid, not just the volume; the concentration equation closes the system.',
        check: `Left side has $${p1}(${v1}) + ${p2}(${v2}) = ${p1 * v1 + p2 * v2}$ units of acid, and $${conc}(${v1 + v2}) = ${conc * (v1 + v2)}$, so the concentrations match.`,
        tagline: 'setup',
      };
    }
    return null;
  }

  // labor
  for (let t = 0; t < 200; t++) {
    const r1 = rng.int(16, 28);
    let r2 = rng.int(9, 15);
    if (r1 === r2) r2 = r1 - 3;
    const h1 = rng.int(3, 12);
    const h2 = rng.int(2, 10);
    const hours = h1 + h2;
    const pay = r1 * h1 + r2 * h2;
    return {
      stem: `Two technicians worked a total of $${hours}$ hours on a job and earned $${pay}$ dollars altogether. One earns $${r1}$ dollars per hour and the other earns $${r2}$ dollars per hour. How many hours did the technician who earns $${r1}$ dollars per hour work?`,
      answer: h1,
      distractors: [
        E(h2, `solved for the other technician's hours`, 'concept'),
        E(pay / r1, `divided the total pay by one hourly rate`, 'setup'),
        E(hours / 2, `split the hours evenly between the two rates`, 'setup'),
        E(hours - h1 + 1, `made an off-by-one error after eliminating`, 'arithmetic'),
      ],
      explanation: `Let $h$ be the hours at $${r1}$ dollars per hour. Then $${r1}h + ${r2}(${hours} - h) = ${pay}$, so $${lin(r1 - r2, 0, 'h')} = ${pay - r2 * hours}$ and $h = ${h1}$.`,
      desmos: `${r1}h + ${r2}(${hours} - h) = ${pay}`,
      skill_note: 'The two hourly rates weight the two unknown hour totals; substituting one into the other is fastest.',
      check: `Checked: $${r1}(${h1}) + ${r2}(${h2}) = ${pay}$ and $${h1} + ${h2} = ${hours}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 15. Systems with no solution
 * ------------------------------------------------------------------ */

function gNoSolution(rng, diff, type) {
  for (let t = 0; t < 200; t++) {
    const b1 = rng.int(2, 6);
    const mult = rng.int(2, 4);
    const b2 = b1 * mult;
    const a1 = rng.int(2, 7);
    const k = a1 * mult;
    const c1 = rng.int(3, 20);
    const c2 = c1 * mult + rng.pick([3, 5, -4, 7, 9]);
    if (a1 * b2 !== b1 * k) continue;
    if (c1 * b2 === c2 * b1) continue;
    return {
      stem: `In the system of equations $${a1}x ${sgn(b1)}y = ${c1}$ and $kx ${sgn(b2)}y = ${c2}$, $k$ is a constant. If the system has no solution, what is the value of $k$?`,
      answer: k,
      distractors: [
        E((a1 * b1) / b2, `inverted the ratio of the $y$-coefficients`, 'concept'),
        E(k + mult, `rounded the proportional coefficient up by one multiple`, 'algebra'),
        E(-k, `matched the ratio but dropped the sign`, 'sign'),
        E(b2 / mult, `divided by the multiplier instead of multiplying`, 'algebra'),
      ],
      explanation: `No solution means the lines are parallel but distinct: $\\frac{${a1}}{k} = \\frac{${b1}}{${b2}}$ with $\\frac{${c1}}{${c2}}$ different. Cross multiplying gives $${b1}k = ${a1 * b2}$, so $k = ${k}$. The constant ratio check fails, so the lines are not the same line.`,
      desmos: `${a1}x + ${b1}y = ${c1}, ${k}x + ${b2}y = ${c2}`,
      skill_note: 'No solution requires equal coefficient ratios but a different constant ratio; the parameter usually sits in one coefficient.',
      check: `Verified $${a1}(${b2}) = ${b1}(${k}) = ${a1 * b2}$ and $${c1}(${b2}) = ${c1 * b2} \\ne ${c2 * b1} = ${c2}(${b1})$.`,
      tagline: 'concept',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 16. Systems with infinitely many solutions
 * ------------------------------------------------------------------ */

function gInfinite(rng, diff, type) {
  for (let t = 0; t < 200; t++) {
    const b1 = rng.int(2, 6);
    const mult = rng.int(2, 4);
    const b2 = b1 * mult;
    const a1 = rng.int(2, 7);
    const k = a1 * mult;
    const c1 = rng.int(3, 18);
    const c2 = c1 * mult;
    if (a1 * b2 !== b1 * k) continue;
    if (c1 * b2 !== c2 * b1) continue;
    return {
      stem: `In the system of equations $${a1}x ${sgn(b1)}y = ${c1}$ and $kx ${sgn(b2)}y = ${c2}$, $k$ is a constant. If the system has infinitely many solutions, what is the value of $k$?`,
      answer: k,
      distractors: [
        E((a1 * b1) / b2, `used the product of the coefficients instead of their ratio`, 'concept'),
        E(c2 / b2, `derived $k$ from the constant terms instead of the $x$-coefficients`, 'setup'),
        E(k + mult, `used a different multiple than the one relating the constants`, 'algebra'),
        E(-k, `matched the ratio but reversed the sign`, 'sign'),
      ],
      explanation: `Infinitely many solutions means the two equations describe the same line, so all three ratios match: $\\frac{${a1}}{${k}} = \\frac{${b1}}{${b2}} = \\frac{${c1}}{${c2}}$. The first equality gives $k = ${k}$, and $${c1}(${b2}) = ${c2}(${b1})$ confirms the constants scale the same way.`,
      desmos: `${a1}x + ${b1}y = ${c1}, ${k}x + ${b2}y = ${c2}`,
      skill_note: 'Infinitely many solutions requires all three ratios to match, not just the coefficients.',
      check: `Verified the full proportion: $${a1 * b2} = ${k * b1}$ and $${c1 * b2} = ${c2 * b1}$.`,
      tagline: 'concept',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 17. Systems with two parameters
 * ------------------------------------------------------------------ */

function gTwoParams(rng, diff, type) {
  const px = rng.int(2, 7);
  const py = rng.int(4, 15);
  const a = rng.int(2, 5);
  const b = rng.int(2, 6);
  const c = py - a * px;
  const d = py + b * px;
  if (!isNice(c) || !isNice(d)) return null;
  const ans = c + d;
  return {
    stem: `The lines $y = ${a}x + c$ and $y = ${-b}x + d$ intersect at the point $(${px}, ${py})$. What is the value of $c + d$?`,
    answer: ans,
    distractors: [
      E(c - d, `subtracted the intercepts instead of adding them`, 'sign'),
      E(py, `used the $y$-coordinate as the sum of the intercepts`, 'concept'),
      E(c * d, `multiplied the intercepts instead of adding them`, 'concept'),
      E(-(c + d), `made a sign error solving for one intercept`, 'sign'),
    ],
    explanation: `Substitute the point into each line. From the first, $${py} = ${a}(${px}) + c$, so $c = ${c}$. From the second, $${py} = ${-b}(${px}) + d$, so $d = ${d}$. Therefore $c + d = ${ans}$.`,
    desmos: `y = ${a}x + ${c}, y = ${-b}x + ${d}`,
    skill_note: 'A point on a line satisfies its equation; each intercept is found by substituting the intersection point.',
    check: `Both lines pass through $(${px}, ${py})$: $${a}(${px}) ${sgn(c)} = ${py}$ and $${-b}(${px}) ${sgn(d)} = ${py}$.`,
    tagline: 'setup',
  };
}

/* ------------------------------------------------------------------ *
 * 18. Constrained linear models
 * ------------------------------------------------------------------ */

function gConstraint(rng, diff, type) {
  const W = rng.int(60, 140);
  const t = rng.int(8, 16);
  const tents = rng.int(1, 3);
  const c = rng.int(4, 9);
  const maxCrates = Math.floor((W - tents * t) / c);
  if (maxCrates < 1) return null;
  const used = tents * t + maxCrates * c;
  if (used > W) return null;
  if (used + c <= W) return null;
  return {
    stem: `${rng.pick(['A hiking group', 'A trail crew', 'A field research team'])} can carry at most $${W}$ pounds of gear. Each tent weighs $${t}$ pounds and each food crate weighs $${c}$ pounds. If the group brings $${tents}$ ${tents === 1 ? 'tent' : 'tents'}, what is the greatest number of food crates they can carry?`,
    answer: maxCrates,
    distractors: [
      E(maxCrates + 1, `rounded up instead of down`, 'concept'),
      E(Math.floor(W / c), `ignored the weight of the tents`, 'setup'),
      E(Math.ceil((W - tents * t) / c), `used the ceiling of the division`, 'concept'),
      E(maxCrates - 1, `stopped one crate short of the maximum`, 'arithmetic'),
    ],
    explanation: `Weight used by tents is $${tents}(${t}) = ${tents * t}$ pounds, leaving $${W - tents * t}$ pounds. Since each crate weighs $${c}$ pounds, the number of crates is $\\frac{${W - tents * t}}{${c}} \\approx ${fmt((W - tents * t) / c)}$, rounded down to $${maxCrates}$.`,
    desmos: `${c}x + ${tents * t} \\le ${W}`,
    skill_note: 'A "greatest number" question needs the floor of the quotient, and every consuming item must be counted.',
    check: `Checked $${tents * t} + ${maxCrates}(${c}) = ${used} \\le ${W}$, while one more crate would need $${used + c} > ${W}$.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 19. Function notation
 * ------------------------------------------------------------------ */

function gFnNotation(rng, diff, type) {
  const a = rng.int(2, 7);
  let b = rng.int(-9, 9);
  if (b === 0) b = 4;
  const k = rng.int(-5, 7);

  if (diff === 'hard' || diff === 'very_hard' || diff === 'extreme') {
    // solve f(x) = v
    const v = a * k + b;
    return {
      stem: `The function $f$ is defined by $f(x) = ${lin(a, b)}$. If $f(x) = ${v}$, what is the value of $x$?`,
      answer: k,
      distractors: [
        E((v + b) / a, `added $${fmt(b)}$ instead of subtracting it`, 'sign'),
        E(v - b, `did not divide by $${a}$`, 'algebra'),
        E(v / a - b, `divided before undoing the constant`, 'algebra'),
        E(-k, `sign error isolating $x$`, 'sign'),
      ],
      explanation: `Set $${lin(a, b)} = ${v}$. Then $${a}x = ${v - b}$ and $x = ${k}$.`,
      desmos: `f(x) = ${lin(a, b)}`,
      skill_note: 'Evaluating and solving are inverse tasks; here the output is known and the input must be isolated.',
      check: `Checked $f(${k}) = ${a}(${k}) ${sgn(b)} = ${v}$.`,
      tagline: 'algebra',
    };
  }

  if (diff === 'medium') {
    const j = rng.int(-4, 5);
    const fj = a * j + b;
    const ans = a * k + b + fj;
    return {
      stem: `The function $f$ is defined by $f(x) = ${lin(a, b)}$. What is the value of $f(${k}) + f(${j})$?`,
      answer: ans,
      distractors: [
        E(a * k + b, `computed only $f(${k})$`, 'concept'),
        E(a * (k + j) + b, `used the sum of the inputs with only one constant term`, 'algebra'),
        E(a * k + b - fj, `subtracted $f(${j})$ instead of adding it`, 'sign'),
        E(a * (k + j) + 2 * b, `doubled the constant when adding the outputs`, 'algebra'),
      ],
      explanation: `$f(${k}) = ${a}(${k}) ${sgn(b)} = ${a * k + b}$ and $f(${j}) = ${a}(${j}) ${sgn(b)} = ${fj}$. Their sum is $${ans}$.`,
      desmos: `f(x) = ${lin(a, b)}`,
      skill_note: 'Function notation means substitution; evaluate each output before combining.',
      check: `Recomputed directly: $f(${k}) = ${a * k + b}$, $f(${j}) = ${fj}$, sum $= ${ans}$.`,
      tagline: 'algebra',
    };
  }

  const ans = a * k + b;
  return {
    stem: `The function $f$ is defined by $f(x) = ${lin(a, b)}$. What is the value of $f(${k})$?`,
    answer: ans,
    distractors: [
      E(a * k - b, `used $${fmt(-b)}$ as the constant`, 'sign'),
      E(a + k + b, `added the coefficient instead of multiplying it`, 'concept'),
      E(-a * k + b, `negated the product $${a}(${k})$`, 'sign'),
      E(k + b, `forgot to multiply by $${a}$`, 'algebra'),
    ],
    explanation: `Substitute $x = ${k}$: $f(${k}) = ${a}(${k}) ${sgn(b)} = ${ans}$. The coefficient $${a}$ multiplies the input, and $${fmt(Math.abs(b))}$ is then ${b > 0 ? 'added' : 'subtracted'}.`,
    desmos: `f(x) = ${lin(a, b)}`,
    skill_note: 'The number inside the parentheses is the input, not a multiplier of the whole function.',
    check: `Evaluated $${a} \\cdot ${k} ${sgn(b)} = ${ans}$ a second time.`,
    tagline: 'algebra',
  };
}

/* ------------------------------------------------------------------ *
 * 20. Linear functions from tables
 * ------------------------------------------------------------------ */

function gTable(rng, diff, type) {
  for (let t = 0; t < 400; t++) {
    const x1 = rng.int(1, 5);
    const x2 = x1 + rng.int(2, 5);
    const x3 = x2 + rng.int(1, 4);
    const m = rng.pick([2, 3, 4, 5, -2, -3, 0.5]);
    const y1 = rng.int(-4, 16);
    const y2 = y1 + m * (x2 - x1);
    const y3 = y1 + m * (x3 - x1);
    if (!isNice(y2) || !isNice(y3)) continue;
    const b = y1 - m * x1;
    if (!isNice(b)) continue;

    if (diff === 'easy') {
      return {
        stem: `The table shows values of a linear function $f$: $f(${x1}) = ${y1}$, $f(${x2}) = ${y2}$, and $f(${x3}) = ${y3}$. What is the value of $f(0)$?`,
        answer: b,
        distractors: [
          E(y1, `used the first table value as the $y$-intercept`, 'concept'),
          E(-b, `sign error extending the pattern backward`, 'sign'),
          E(y1 - m * (x1 + 1), `subtracted one extra step when moving backward`, 'algebra'),
          E(m, `gave the rate of change instead of the value at $0$`, 'concept'),
        ],
        explanation: `The rate of change is $\\frac{${y2} - ${pn(y1)}}{${x2} - ${x1}} = ${fmt(m)}$. Working backward from $f(${x1}) = ${y1}$, $f(0) = ${y1} - ${pn(m)}(${x1}) = ${b}$.`,
        desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
        skill_note: 'Extending a table backward requires subtracting the rate once per step, not just reading the first entry.',
        check: `Checked the model $f(x) = ${fmt(m)}x ${sgn(b)}$ at all three table inputs: it returns $${y1}$, $${y2}$, and $${y3}$.`,
        tagline: 'concept',
      };
    }

    if (diff === 'medium') {
      return {
        stem: `The table shows values of a linear function $f$: $f(${x1}) = ${y1}$, $f(${x2}) = ${y2}$, and $f(${x3}) = ${y3}$. What is the value of $f(${x3 + 2})$?`,
        answer: y1 + m * (x3 + 2 - x1),
        distractors: [
          E(y3 + 2, `added $2$ to the output instead of two steps of the rate`, 'concept'),
          E(y3 + m, `added only one step of the rate`, 'algebra'),
          E(y3 - m, `subtracted the rate instead of adding it`, 'sign'),
          E(y1 + m * (x3 + 2), `used $y_1$ as the intercept instead of finding it`, 'setup'),
        ],
        explanation: `Each increase of $1$ in $x$ changes $f$ by $${fmt(m)}$. From $f(${x3}) = ${y3}$, two more steps give $${y3} + 2(${fmt(m)}) = ${y3 + 2 * m}$.`,
        desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
        skill_note: 'A table is a rate pattern; extend it by the step size, not by the input difference.',
        check: `Verified with the model $f(x) = ${fmt(m)}x ${sgn(b)}$: $f(${x3 + 2}) = ${y1 + m * (x3 + 2 - x1)}$.`,
        tagline: 'concept',
      };
    }

    if (type === 'spr') {
      return {
        stem: `The table shows values of a linear function $f$: $f(${x1}) = ${y1}$, $f(${x2}) = ${y2}$, and $f(${x3}) = ${y3}$. What is the rate of change of $f$?`,
        answer: m,
        distractors: [
          E(-m, `subtracted the outputs in the opposite order`, 'sign'),
          E(x2 - x1, `used the change in the input as the rate`, 'concept'),
          E(1 / m, `inverted the rate of change`, 'concept'),
          E(y2 / x2, `divided an output by its input instead of taking differences`, 'setup'),
        ],
        explanation: `The rate of change is $\\frac{f(${x2}) - f(${x1})}{${x2} - ${x1}} = \\frac{${y2} - ${y1}}{${x2 - x1}} = ${fmt(m)}$. Every increase of $1$ in $x$ changes $f(x)$ by $${fmt(m)}$.`,
        desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
        skill_note: 'Rate of change is a difference of outputs over a difference of inputs, not a ratio of single values.',
        check: `Recomputed from the second and third entries: $\\frac{${y3} - ${y2}}{${x3 - x2}} = ${fmt(m)}$, the same rate.`,
        tagline: 'concept',
      };
    }
    const opts = [
      C(`$f(x) = ${fmt(m)}x ${sgn(b)}$`, 'correct', 'none'),
      C(`$f(x) = ${fmt(m)}x ${sgn(y1)}$`, `used $f(${x1})$ as the intercept without adjusting for the slope`, 'setup'),
      C(`$f(x) = ${fmt(-m)}x ${sgn(b)}$`, `computed the rate of change with the inputs reversed`, 'sign'),
      C(`$f(x) = ${fmt(b)}x ${sgn(m)}$`, `swapped the rate and the intercept`, 'concept'),
    ];
    if (new Set(opts.map((o) => o.text)).size !== 4) continue;
    return {
      stem: `The table shows values of a linear function $f$: $f(${x1}) = ${y1}$, $f(${x2}) = ${y2}$, and $f(${x3}) = ${y3}$. Which equation defines $f$?`,
      choices: opts,
      explanation: `The rate of change is $\\frac{${y2} - ${pn(y1)}}{${x2} - ${x1}} = ${fmt(m)}$. Substituting $(${x1}, ${y1})$ gives $${fmt(m)}(${x1}) + b = ${y1}$, so $b = ${b}$ and $f(x) = ${fmt(m)}x ${sgn(b)}$.`,
      desmos: `(${x1}, ${y1}), (${x2}, ${y2})`,
      skill_note: 'Every table entry must satisfy the rule; the intercept is not simply the first output.',
      check: `Evaluated the chosen rule at all three table inputs and recovered $${y1}$, $${y2}$, $${y3}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 21. Composition of linear functions
 * ------------------------------------------------------------------ */

function gCompose(rng, diff, type) {
  const a = rng.int(2, 5);
  let b = rng.int(-7, 7);
  if (b === 0) b = 2;
  const c = rng.int(2, 4);
  let d = rng.int(-7, 7);
  if (d === 0) d = 3;
  const k = rng.int(-4, 5);
  const inner = c * k + d;
  const val = a * inner + b;

  const numericItem = () => ({
    stem: `The functions $f$ and $g$ are defined by $f(x) = ${lin(a, b)}$ and $g(x) = ${lin(c, d)}$. What is the value of $f(g(${k}))$?`,
    answer: val,
    distractors: [
      E(a * (c * k + d + b), `added $${b}$ inside $g$ before applying $f$`, 'algebra'),
      E(a * k + b + c * k + d, `added the two function values instead of composing`, 'concept'),
      E(c * (a * k + b) + d, `composed in the opposite order`, 'concept'),
      E(a * c * k + d + b, `distributed but attached $${b}$ without multiplying by $${a}$`, 'algebra'),
    ],
    explanation: `First $g(${k}) = ${c}(${k}) ${sgn(d)} = ${inner}$. Then $f(${inner}) = ${a}(${inner}) ${sgn(b)} = ${val}$.`,
    desmos: `f(x) = ${lin(a, b)}, g(x) = ${lin(c, d)}`,
    skill_note: 'Work from the inside out; the inner output becomes the outer input.',
    check: `Recomputed: $g(${k}) = ${inner}$ and $f(${inner}) = ${val}$.`,
    tagline: 'concept',
  });

  if (type === 'spr' || diff === 'easy' || diff === 'medium') return numericItem();

  const A = a * c;
  const B = a * d + b;
  const opts = [
    C(`$${A}x ${sgn(B)}$`, 'correct', 'none'),
    C(`$${A}x ${sgn(a * d)}$`, `dropped the constant $${b}$ after substituting`, 'algebra'),
    C(`$${a + c}x ${sgn(b + d)}$`, `added the two functions instead of composing them`, 'concept'),
    C(`$${A}x ${sgn(b * d)}$`, `multiplied the constants instead of distributing $${a}$`, 'algebra'),
  ];
  if (new Set(opts.map((o) => o.text)).size !== 4) return numericItem();
  // independent check: candidate must agree with f(g(x)) at x = 0, 1, 2
  const fg = (x) => a * (c * x + d) + b;
  const okPair = (p, q) => [0, 1, 2].every((x) => eqv(p * x + q, fg(x)));
  const wrongPairs = [
    [A, a * d],
    [a + c, b + d],
    [A, b * d],
  ];
  if (!okPair(A, B)) return null;
  for (const [p, q] of wrongPairs) if (okPair(p, q)) return null;
  return {
    stem: `The functions $f$ and $g$ are defined by $f(x) = ${lin(a, b)}$ and $g(x) = ${lin(c, d)}$. Which expression is equal to $f(g(x))$?`,
    choices: opts,
    explanation: `Substitute $g(x)$ into $f$: $f(g(x)) = ${a}(${lin(c, d)}) ${sgn(b)} = ${A}x ${sgn(a * d)} ${sgn(b)} = ${A}x ${sgn(B)}$. The slope is the product of the two slopes, and the constant is $${a}(${d}) ${sgn(b)} = ${B}$.`,
    desmos: `f(x) = ${lin(a, b)}, g(x) = ${lin(c, d)}`,
    skill_note: 'Composition is not multiplication: the outer function acts on the entire inner expression.',
    check: `Evaluated the correct expression and all three distractors at $x = 0, 1, 2$; only $${A}x ${sgn(B)}$ matched $f(g(x))$ at every point.`,
    tagline: 'algebra',
  };
}

/* ------------------------------------------------------------------ *
 * 22. Rate, speed, and time
 * ------------------------------------------------------------------ */

function gRate(rng, diff, type) {
  const r = rng.int(30, 70);
  const t = rng.int(2, 7);
  const R = rng.int(10, 45);
  const D = R + r * t;
  if (!Number.isInteger(D)) return null;
  const ans = t;
  const vehicle = rng.pick(['A delivery van', 'A freight train', 'A city bus', 'A moving truck']);
  return {
    stem: `${vehicle} is $${D}$ miles from its depot and travels toward the depot at a constant speed of $${r}$ miles per hour. After how many hours will it be $${R}$ miles from the depot?`,
    answer: ans,
    distractors: [
      E((D + R) / r, `added the remaining distance instead of subtracting it`, 'sign'),
      E(D / r, `solved for the time to reach the depot entirely`, 'setup'),
      E(R / r, `used only the remaining distance`, 'setup'),
      E(t + 1, `made an off-by-one error after dividing`, 'arithmetic'),
    ],
    explanation: `The vehicle must cover $${D} - ${R} = ${D - R}$ miles. At $${r}$ miles per hour, the time is $\\frac{${D - R}}{${r}} = ${t}$ hours.`,
    desmos: `${D} - ${r}t = ${R}`,
    skill_note: 'Distance still to travel is the difference; dividing that by the rate gives the time, not dividing the total.',
    check: `Checked $${D} - ${r}(${t}) = ${R}$ miles remaining.`,
    tagline: 'setup',
  };
}

/* ------------------------------------------------------------------ *
 * 23. Interpreting parameters of a model
 * ------------------------------------------------------------------ */

function gInterp(rng, diff, type) {
  const ctx = rng.pick(PLAN_CTX);
  const m = rng.pick([2, 4, 5, 6, 9, 11]);
  const b = rng.pick([15, 22, 30, 35, 48, 60]);
  const cands = [
    C(`the ${ctx.fixed}, charged even when $x = 0$`, 'correct', 'none'),
    C(`the cost of each additional ${ctx.unit}`, `described the coefficient instead of the constant`, 'concept'),
    C(`the total cost after $${b}$ ${ctx.unit}s`, `attached the constant's value to the wrong quantity`, 'quantity'),
    C(`the number of ${ctx.unit}s at which the cost is $${m}$ dollars`, `solved a cost equation that the model does not describe`, 'setup'),
  ];
  return {
    stem: `${ctx.s(m, b)} The total cost $C$, in dollars, for $x$ ${ctx.unit}s is given by $C = ${m}x + ${b}$. What does $${b}$ represent in this model?`,
    choices: cands,
    explanation: `Setting $x = 0$ gives $C = ${b}$, so the constant is the ${ctx.fixed} paid before any ${ctx.unit} is used. The coefficient $${m}$ is the charge per ${ctx.unit}.`,
    desmos: `y = ${m}x + ${b}`,
    skill_note: 'The constant term is the value of the model at zero input, not the per-unit rate.',
    check: `Evaluated $C(0) = ${b}$ and $C(${b}) = ${m * b + b} \\ne ${m}$ to rule out the distractor readings.`,
    tagline: 'concept',
  };
}

/* ------------------------------------------------------------------ *
 * 24. Break-even
 * ------------------------------------------------------------------ */

function gBreakEven(rng, diff, type) {
  for (let t = 0; t < 300; t++) {
    const p = rng.int(12, 30);
    const m = rng.int(3, p - 2);
    const b = rng.int(5, 60) * rng.int(2, 6);
    const q = b / (p - m);
    if (!Number.isInteger(q) || q <= 0 || q > 200) continue;
    if (p * q !== m * q + b) continue;
    const product = rng.pick(['phone stands', 'cutting boards', 'ceramic mugs', 'desk lamps', 'bike racks']);
    const unitWord = product.split(' ').pop().replace(/s$/, '');
    return {
      stem: `A workshop makes ${product} that sell for $${p}$ dollars each. The materials cost $${m}$ dollars per ${unitWord}, and the workshop also pays $${b}$ dollars in fixed equipment costs. How many ${product} must the workshop sell to break even?`,
      answer: q,
      distractors: [
        E(q + 1, `rounded up instead of solving the equation exactly`, 'arithmetic'),
        E(Math.ceil(b / p), `ignored the per-unit material cost`, 'setup'),
        E(b - p + m, `subtracted costs instead of dividing the fixed cost`, 'setup'),
        E(p - m, `gave the profit per unit instead of the number of units`, 'concept'),
      ],
      explanation: `Break-even means revenue equals cost: $${p}x = ${m}x + ${b}$. So $${p - m}x = ${b}$ and $x = ${q}$.`,
      desmos: `y = ${p}x, y = ${m}x + ${b}`,
      skill_note: 'Break-even is the intersection of revenue and cost; the profit per unit is the denominator.',
      check: `Checked $${p}(${q}) = ${p * q}$ equals $${m}(${q}) + ${b} = ${m * q + b}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 25. Age and time problems
 * ------------------------------------------------------------------ */

function gAge(rng, diff, type) {
  for (let t = 0; t < 400; t++) {
    const s = rng.int(4, 15);
    const k = rng.int(2, 5);
    const m = rng.int(2, k - 1);
    if (m >= k) continue;
    const num = s * (k - m);
    const den = m - 1;
    if (den <= 0) continue;
    if (num % den !== 0) continue;
    const n = num / den;
    if (n < 2 || n > 25) continue;
    if (k * s + n !== m * (s + n)) continue;
    const name = rng.pick(NAMES);
    return {
      stem: `${name} is $${k}$ times as old as her son. In $${n}$ years, she will be $${m}$ times as old as her son. How old is her son now?`,
      answer: s,
      distractors: [
        E(k * s, `gave the mother's current age`, 'concept'),
        E(s + n, `gave the son's age in $${n}$ years`, 'concept'),
        E(k * s - s, `gave the difference in their ages`, 'quantity'),
        E(s - n, `subtracted the years instead of adding them`, 'sign'),
      ],
      explanation: `Let $s$ be the son's age. Then $${k}s + ${n} = ${m}(s + ${n})$, so $${lin(k - m, 0, 's')} = ${m * n - n}$ and $s = ${s}$.`,
      desmos: `${k}s + ${n} = ${m}(s + ${n})`,
      skill_note: 'Both people age by the same amount; the multiplier applies to the future ages, not the current ones.',
      check: `Checked now: mother $${k * s}$, son $${s}$. In $${n}$ years: $${k * s + n}$ and $${s + n}$, and $${m}(${s + n}) = ${k * s + n}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 26. Consecutive integers
 * ------------------------------------------------------------------ */

function gConsecutive(rng, diff, type) {
  const kind = rng.pick(['integers', 'odd integers', 'even integers']);
  const step = kind === 'integers' ? 1 : 2;
  let n = rng.int(-6, 18);
  if (kind === 'odd integers' && n % 2 === 0) n += 1;
  if (kind === 'even integers' && n % 2 !== 0) n += 1;
  const nums = [n, n + step, n + 2 * step];
  const sum = nums[0] + nums[1] + nums[2];
  const askLargest = rng.chance(0.6);
  const ans = askLargest ? nums[2] : nums[0];
  const label = kind === 'integers' ? 'integers' : kind;
  return {
    stem: `The sum of three consecutive ${label} is $${sum}$. What is the ${askLargest ? 'largest' : 'smallest'} of the three ${label}?`,
    answer: ans,
    distractors: [
      E(askLargest ? nums[0] : nums[2], `gave the other end of the list`, 'concept'),
      E(nums[1], `gave the middle term`, 'concept'),
      E(sum / 3, `divided the sum by $3$ and stopped`, 'algebra'),
      E(ans + step, `went one step past the requested term`, 'arithmetic'),
    ],
    explanation: `Let the middle term be $n$. Then the three terms are $n - ${step}$, $n$, and $n + ${step}$, and their sum is $3n = ${sum}$, so $n = ${sum / 3}$. The ${askLargest ? 'largest' : 'smallest'} term is $${ans}$.`,
    desmos: `n + (n + ${step}) + (n + ${2 * step}) = ${sum}`,
    skill_note: 'Consecutive terms share a common difference of $1$ (or $2$ for same-parity lists); center the variable to simplify.',
    check: `Added the three terms $${nums[0]} + ${nums[1]} + ${nums[2]} = ${sum}$, then confirmed the requested term is $${ans}$.`,
    tagline: 'algebra',
  };
}

/* ------------------------------------------------------------------ *
 * 27. Proportions and cross-multiplication
 * ------------------------------------------------------------------ */

function gProportion(rng, diff, type) {
  if (rng.chance(0.5)) {
    const a = rng.int(2, 9);
    const t = rng.int(2, 9);
    const c = a * t;
    const b = rng.int(3, 14);
    const x = b * t;
    if (!Number.isInteger(x)) return null;
    return {
      stem: `If $\\frac{${a}}{${b}} = \\frac{${c}}{x}$, what is the value of $x$?`,
      answer: x,
      distractors: [
        E((b * c) / a + a, `added the numerator after cross multiplying`, 'arithmetic'),
        E((a * b) / c, `multiplied the wrong pair when cross multiplying`, 'algebra'),
        E(b + c - a, `added and subtracted the known terms instead of scaling`, 'concept'),
        E(c - b, `subtracted the denominators`, 'concept'),
      ],
      explanation: `Cross multiply: $${a}x = ${b}(${c}) = ${b * c}$, so $x = ${x}$. Equivalently, the ratio scaled by $${t}$, so $x = ${b}(${t}) = ${x}$.`,
      desmos: `${a}/${b} = ${c}/x`,
      skill_note: 'Cross multiplication pairs each numerator with the opposite denominator; scaling gives a quick check.',
      check: `Checked by cross multiplying: $${a}(${x}) = ${a * x}$ and $${b}(${c}) = ${b * c}$, which match.`,
      tagline: 'algebra',
    };
  }

  for (let t = 0; t < 300; t++) {
    const k = rng.pick([2, 3, 4, 5, 6, 0.5, 1.5]);
    const x1 = rng.int(2, 12);
    const y1 = k * x1;
    const x2 = rng.int(2, 14);
    const y2 = k * x2;
    if (!isNice(y1) || !isNice(y2) || y1 === y2) continue;
    return {
      stem: `The quantity $y$ is directly proportional to $x$. When $x = ${x1}$, $y = ${fmt(y1)}$. What is the value of $y$ when $x = ${x2}$?`,
      answer: y2,
      distractors: [
        E(y1 + (x2 - x1), `added the change in $x$ directly to $y$`, 'concept'),
        E((y1 * x2) / x1 + x1, `multiplied by the new $x$ and then added it again`, 'arithmetic'),
        E((x1 * x2) / y1, `inverted the proportion`, 'setup'),
        E(y1, `assumed $y$ does not change`, 'concept'),
      ],
      explanation: `Direct proportionality means $y = kx$. Here $k = \\frac{${fmt(y1)}}{${x1}} = ${fmt(k)}$, so when $x = ${x2}$, $y = ${fmt(k)}(${x2}) = ${fmt(y2)}$.`,
      desmos: `y = ${fmt(k)}x`,
      skill_note: 'Find the constant of proportionality first; adding the change in $x$ ignores the rate.',
      check: `Checked the ratio: $\\frac{${fmt(y1)}}{${x1}} = \\frac{${fmt(y2)}}{${x2}} = ${fmt(k)}$.`,
      tagline: 'setup',
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * registry
 * ------------------------------------------------------------------ */

function pickDiff(rng, w) {
  const entries = Object.entries(w).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = rng.f() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export const SKILLS = [
  { name: 'Linear equations in one variable', gen: gLinearOne, count: 14, spr: 0.15, diff: { easy: 5, medium: 3, hard: 1.6, very_hard: 0.4 } },
  { name: 'Linear equations with distribution', gen: gDistribute, count: 13, spr: 0.2, diff: { easy: 3, medium: 4, hard: 2.5, very_hard: 0.5 } },
  { name: 'Linear equations with fractions', gen: gFractions, count: 14, spr: 0.2, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Linear inequalities in one variable', gen: gInequality, count: 13, spr: 0.3, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Compound inequalities', gen: gCompound, count: 13, spr: 0.35, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Absolute value equations', gen: gAbsEq, count: 13, spr: 0.3, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Absolute value inequalities', gen: gAbsIneq, count: 13, spr: 0.3, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Slope from two points', gen: gSlopePoints, count: 14, spr: 0.3, diff: { easy: 4, medium: 3, hard: 2, very_hard: 1 } },
  { name: 'Slope and intercept interpretation', gen: gSlopeInterp, count: 13, spr: 0, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Linear models from two data points', gen: gModelTwoPoints, count: 14, spr: 0.25, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Equations of lines', gen: gLineEq, count: 14, spr: 0.2, diff: { easy: 3, medium: 3, hard: 2.5, very_hard: 1.5 } },
  { name: 'Parallel and perpendicular lines', gen: gParallelPerp, count: 13, spr: 0.25, diff: { easy: 2, medium: 3, hard: 3, very_hard: 2 } },
  { name: 'Systems of two linear equations', gen: gSystem, count: 14, spr: 0.3, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Systems word problems', gen: gSystemWord, count: 14, spr: 0.3, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Systems with no solution', gen: gNoSolution, count: 13, spr: 0.3, diff: { medium: 4, hard: 3, very_hard: 2.5, extreme: 0.5 } },
  { name: 'Systems with infinitely many solutions', gen: gInfinite, count: 13, spr: 0.3, diff: { medium: 4, hard: 3, very_hard: 2.5, extreme: 0.5 } },
  { name: 'Systems with two parameters', gen: gTwoParams, count: 13, spr: 0.25, diff: { medium: 3, hard: 3, very_hard: 2.5, extreme: 1.5 } },
  { name: 'Constrained linear models', gen: gConstraint, count: 13, spr: 0.45, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Function notation', gen: gFnNotation, count: 14, spr: 0.3, diff: { easy: 5, medium: 3, hard: 1.5, very_hard: 0.5 } },
  { name: 'Linear functions from tables', gen: gTable, count: 13, spr: 0.25, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Composition of linear functions', gen: gCompose, count: 13, spr: 0.2, diff: { medium: 3, hard: 3, very_hard: 2, extreme: 2 } },
  { name: 'Rate, speed, and time', gen: gRate, count: 13, spr: 0.35, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Interpreting parameters of a model', gen: gInterp, count: 13, spr: 0, diff: { easy: 3, medium: 4, hard: 2, very_hard: 1 } },
  { name: 'Break-even analysis', gen: gBreakEven, count: 13, spr: 0.45, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Age and time problems', gen: gAge, count: 13, spr: 0.35, diff: { easy: 2, medium: 4, hard: 2.5, very_hard: 1.5 } },
  { name: 'Consecutive integers', gen: gConsecutive, count: 14, spr: 0.4, diff: { easy: 4, medium: 3, hard: 2, very_hard: 1 } },
  { name: 'Proportions and cross-multiplication', gen: gProportion, count: 13, spr: 0.35, diff: { easy: 4, medium: 3, hard: 2, very_hard: 1 } },
];

/* ------------------------------------------------------------------ *
 * assembly
 * ------------------------------------------------------------------ */

const TAGS = new Set(['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none']);
const DIFFS = new Set(['easy', 'medium', 'hard', 'very_hard', 'extreme']);

function balanced(s) {
  return typeof s === 'string' && (s.match(/\$/g) || []).length % 2 === 0;
}

function textOk(s) {
  return (
    typeof s === 'string' &&
    s.length > 0 &&
    balanced(s) &&
    !/NaN|undefined|Infinity|null/.test(s)
  );
}

function sentenceCount(s) {
  return (s.match(/[.!?](\s|$)/g) || []).length;
}

function assembleNumeric(raw, rng) {
  if (!isNice(raw.answer)) return null;
  const seen = new Set([fmt(raw.answer)]);
  const pool = [];
  const spread = 20 * Math.abs(raw.answer) + 50;
  for (const c of raw.distractors || []) {
    if (!c || !Number.isFinite(c.v) || !isNice(c.v)) continue;
    if (Math.abs(c.v) > spread) continue; // implausible outlier, not a useful trap
    const key = fmt(c.v);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ ...c, key });
  }
  if (pool.length < 3) return null;
  const three = rng.shuffle(pool).slice(0, 3);
  const opts = rng.shuffle([{ v: raw.answer, key: fmt(raw.answer), note: 'correct', tag: 'none' }, ...three]);
  const keyIndex = opts.findIndex((o) => o.tag === 'none');
  if (keyIndex < 0) return null;
  return {
    choices: opts.map((o) => `$${o.key}$`),
    notes: opts.map((o) => o.note),
    tags: opts.map((o) => o.tag),
    answer: 'ABCD'[keyIndex],
  };
}

function assembleText(raw, rng) {
  if (!Array.isArray(raw.choices)) return null;
  if (raw.choices.some((c) => !c || !c.text || !c.note)) return null;
  const seen = new Set();
  const uniq = [];
  for (const c of raw.choices) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    uniq.push({ ...c });
  }
  const correct = uniq.filter((c) => c.tag === 'none');
  const wrong = uniq.filter((c) => c.tag !== 'none');
  if (correct.length !== 1 || wrong.length < 3) return null;
  const opts = rng.shuffle([correct[0], ...rng.shuffle(wrong).slice(0, 3)]);
  const keyIndex = opts.findIndex((o) => o.tag === 'none');
  return {
    choices: opts.map((o) => o.text),
    notes: opts.map((o) => o.note),
    tags: opts.map((o) => o.tag),
    answer: 'ABCD'[keyIndex],
  };
}

function sprAnswers(v) {
  const out = [fmt(v)];
  if (isInt(v)) out.push(`${Math.round(v)}.0`);
  return out;
}

// global difficulty calibration so the bank hits the target mix
// (~25% easy, 30% medium, 25% hard, 15% very_hard, 5% extreme)
const DIFF_TUNE = { easy: 0.84, medium: 0.73, hard: 0.98, very_hard: 1.0, extreme: 3.72 };

function tuneWeights(w) {
  const out = {};
  for (const k of Object.keys(w)) out[k] = w[k] * (DIFF_TUNE[k] === undefined ? 1 : DIFF_TUNE[k]);
  return out;
}

// split a count across weighted buckets using largest remainders
function allocate(count, weights) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  const raw = keys.map((k) => ({ k, v: (count * weights[k]) / total }));
  const out = [];
  for (const r of raw) for (let i = 0; i < Math.floor(r.v); i++) out.push(r.k);
  const byFrac = raw.slice().sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  let i = 0;
  while (out.length < count) out.push(byFrac[i++ % byFrac.length].k);
  return out;
}

// global spr share target: 25% of all items, spread over skills by their spr weight
function sprFactor() {
  const totalItems = SKILLS.reduce((s, x) => s + x.count, 0);
  const exact = SKILLS.reduce((s, x) => s + x.count * x.spr, 0);
  return (0.25 * totalItems) / exact;
}

export function generate(opts = {}) {
  const seed = opts.seed === undefined ? SEED : opts.seed;
  const rng = new Rng(seed);
  const items = [];
  const stems = new Set();
  const sf = sprFactor();

  for (const spec of SKILLS) {
    let made = 0;
    let guard = 0;
    const limit = spec.count * 800;
    const diffPlan = rng.shuffle(allocate(spec.count, tuneWeights(spec.diff)));
    const sprSlots = Math.round(spec.count * spec.spr * sf);
    const typePlan = rng.shuffle([
      ...Array(sprSlots).fill('spr'),
      ...Array(spec.count - sprSlots).fill('mcq'),
    ]);
    while (made < spec.count) {
      if (++guard > limit) throw new Error(`generator stuck on ${spec.name} (${made}/${spec.count}) at ${diffPlan[made]}/${typePlan[made]}`);
      const diff = diffPlan[made];
      const type = typePlan[made];
      let raw = null;
      try {
        raw = spec.gen(rng, diff, type);
      } catch (err) {
        raw = null;
      }
      if (!raw) continue;
      if (!textOk(raw.stem) || !textOk(raw.explanation) || !textOk(raw.check)) continue;
      if (stems.has(raw.stem)) continue;
      const sc = sentenceCount(raw.explanation);
      if (sc < 2 || sc > 4) continue;

      let built;
      if (type === 'mcq') {
        built = Array.isArray(raw.choices) ? assembleText(raw, rng) : assembleNumeric(raw, rng);
      } else {
        if (Array.isArray(raw.choices)) continue;
        if (!isNice(raw.answer)) continue;
        built = { answer: null, accepted: sprAnswers(raw.answer) };
      }
      if (!built) continue;
      if (type === 'mcq' && !(built.choices.every(textOk))) continue;

      stems.add(raw.stem);
      const idx = items.length + 1;
      const item = {
        id: `ALG-${String(idx).padStart(4, '0')}`,
        section: 'math',
        domain: DOMAIN,
        skill: spec.name,
        difficulty: diff,
        type,
        stem: raw.stem,
      };
      if (type === 'mcq') {
        item.choices = built.choices;
        item.answer = built.answer;
        item.choice_notes = built.notes;
        item.error_tags = built.tags;
      } else {
        item.accepted_spr = built.accepted;
      }
      item.explanation = raw.explanation;
      item.desmos = raw.desmos;
      item.skill_note = raw.skill_note;
      item.check = raw.check;
      items.push(item);
      made++;
    }
  }
  return items;
}

/* ------------------------------------------------------------------ *
 * validation
 * ------------------------------------------------------------------ */

export function validate(items) {
  const errors = [];
  const ids = new Set();
  const stems = new Set();
  const byDiff = {};
  const byType = {};
  const bySkill = {};
  const byTag = {};

  items.forEach((it, i) => {
    const at = `item ${i + 1} (${it && it.id})`;
    if (!it || typeof it !== 'object') return errors.push(`${at}: not an object`);
    for (const k of ['id', 'section', 'domain', 'skill', 'difficulty', 'type', 'stem', 'explanation', 'desmos', 'skill_note', 'check']) {
      if (!it[k] || typeof it[k] !== 'string') errors.push(`${at}: missing/blank ${k}`);
    }
    if (!/^ALG-\d{4}$/.test(it.id || '')) errors.push(`${at}: bad id format`);
    if (ids.has(it.id)) errors.push(`${at}: duplicate id`);
    ids.add(it.id);
    if (it.section !== 'math') errors.push(`${at}: section must be math`);
    if (it.domain !== 'Algebra') errors.push(`${at}: domain must be Algebra`);
    if (!DIFFS.has(it.difficulty)) errors.push(`${at}: bad difficulty ${it.difficulty}`);
    if (it.type !== 'mcq' && it.type !== 'spr') errors.push(`${at}: bad type`);
    if (stems.has(it.stem)) errors.push(`${at}: duplicate stem`);
    stems.add(it.stem);

    for (const f of ['stem', 'explanation', 'skill_note', 'check', 'desmos']) {
      if (typeof it[f] === 'string') {
        if (!balanced(it[f])) errors.push(`${at}: unbalanced $ in ${f}`);
        if (/NaN|undefined|Infinity/.test(it[f])) errors.push(`${at}: bad token in ${f}`);
      }
    }
    const sc = sentenceCount(it.explanation || '');
    if (sc < 2 || sc > 4) errors.push(`${at}: explanation has ${sc} sentences`);

    if (it.type === 'mcq') {
      if (!Array.isArray(it.choices) || it.choices.length !== 4) errors.push(`${at}: needs 4 choices`);
      else {
        if (new Set(it.choices).size !== 4) errors.push(`${at}: duplicate choices`);
        if (!it.choices.every(textOk)) errors.push(`${at}: bad choice text`);
        const key = 'ABCD'.indexOf(it.answer);
        if (key < 0 || key > 3) errors.push(`${at}: answer not A-D`);
        else {
          if (it.choice_notes[key] !== 'correct') errors.push(`${at}: key note is not "correct"`);
          if (it.error_tags[key] !== 'none') errors.push(`${at}: key tag is not "none"`);
        }
      }
      if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) errors.push(`${at}: notes length`);
      if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) errors.push(`${at}: tags length`);
      for (const t of it.error_tags || []) if (!TAGS.has(t)) errors.push(`${at}: bad tag ${t}`);
      if (!it.answer || !/^[ABCD]$/.test(it.answer)) errors.push(`${at}: answer missing`);
      if (it.accepted_spr !== undefined) errors.push(`${at}: mcq must not have accepted_spr`);
    } else {
      if (!Array.isArray(it.accepted_spr) || it.accepted_spr.length === 0) errors.push(`${at}: spr needs accepted_spr`);
      else if (!it.accepted_spr.every((s) => typeof s === 'string' && s.length > 0)) errors.push(`${at}: bad accepted_spr`);
      if (it.choices !== undefined) errors.push(`${at}: spr must not have choices`);
      if (it.answer !== undefined) errors.push(`${at}: spr must not have answer`);
    }

    byDiff[it.difficulty] = (byDiff[it.difficulty] || 0) + 1;
    byType[it.type] = (byType[it.type] || 0) + 1;
    bySkill[it.skill] = (bySkill[it.skill] || 0) + 1;
    for (const t of it.error_tags || []) byTag[t] = (byTag[t] || 0) + 1;
  });

  if (items.length < 340) errors.push(`only ${items.length} items, need >= 340`);
  for (const k of ['easy', 'medium', 'hard', 'very_hard', 'extreme']) {
    if (!byDiff[k]) errors.push(`no items at difficulty ${k}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      count: items.length,
      byDiff,
      byType,
      distinctSkills: Object.keys(bySkill).length,
      bySkill,
      byTag,
    },
  };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function main() {
  const items = generate();
  const report = validate(items);
  const outDir = new URL('../generated/', import.meta.url);
  const outFile = new URL('math-algebra.json', outDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify({ items }, null, 2) + '\n', 'utf8');

  const pct = (n) => `${((n / report.stats.count) * 100).toFixed(1)}%`;
  console.log(`wrote ${items.length} items -> ${fileURLToPath(outFile)}`);
  console.log('\ndifficulty:');
  for (const k of ['easy', 'medium', 'hard', 'very_hard', 'extreme']) {
    console.log(`  ${k.padEnd(10)} ${String(report.stats.byDiff[k] || 0).padStart(3)}  ${pct(report.stats.byDiff[k] || 0)}`);
  }
  console.log('\ntype:');
  for (const k of ['mcq', 'spr']) {
    console.log(`  ${k.padEnd(10)} ${String(report.stats.byType[k] || 0).padStart(3)}  ${pct(report.stats.byType[k] || 0)}`);
  }
  console.log(`\ndistinct skills: ${report.stats.distinctSkills}`);
  for (const [k, v] of Object.entries(report.stats.bySkill)) {
    console.log(`  ${String(v).padStart(2)}  ${k}`);
  }
  console.log('\nvalidation:', report.ok ? 'PASS' : 'FAIL');
  for (const e of report.errors.slice(0, 40)) console.log('  ! ' + e);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
