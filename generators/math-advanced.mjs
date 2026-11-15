// ============================================================
// SAT Advanced Math — parametric question generator
// Deterministic: mulberry32 only. No Math.random anywhere.
// Every answer is computed from drawn parameters and checked
// by a second, independent computation before the item ships.
// ============================================================

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class BuildError extends Error {}
function need(cond, msg) {
  if (!cond) throw new BuildError(msg);
}

let rnd = mulberry32(1);
const ri = (a, b) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new BuildError('bad integer bounds');
  return a + Math.floor(rnd() * (b - a + 1));
};
const pick = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) throw new BuildError('empty pick');
  return arr[Math.floor(rnd() * arr.length)];
};
const chance = (p) => rnd() < p;
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const nz = (lim) => {
  let v = 0;
  while (v === 0) v = ri(-lim, lim);
  return v;
};
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/* ---------------- formatting ---------------- */

function poly(a, b, c) {
  let s = '';
  if (a !== 0) s += a === 1 ? 'x^2' : a === -1 ? '-x^2' : a + 'x^2';
  if (b !== 0) {
    if (s === '') s += b === 1 ? 'x' : b === -1 ? '-x' : b + 'x';
    else s += (b > 0 ? ' + ' : ' - ') + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'x';
  }
  if (c !== 0) {
    if (s === '') s += String(c);
    else s += (c > 0 ? ' + ' : ' - ') + Math.abs(c);
  }
  return s === '' ? '0' : s;
}

const fac = (r) => (r >= 0 ? `(x-${r})` : `(x+${-r})`);
const facLead = (a, r) => (r >= 0 ? `(${a}x-${a * r})` : `(${a}x+${-a * r})`);
const pairText = (p, q) => `$x=${Math.min(p, q)}$ and $x=${Math.max(p, q)}$`;

function linX(b) {
  if (b === 0) return '';
  return (b > 0 ? ' + ' : ' - ') + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'x';
}
function constC(c) {
  if (c === 0) return '';
  return (c > 0 ? ' + ' : ' - ') + Math.abs(c);
}
function lineExpr(m, k) {
  const lead = m === 1 ? 'x' : m === -1 ? '-x' : m + 'x';
  return lead + constC(k);
}
function lin1(k) {
  return 'x' + constC(k);
}
function cubic(a, b, c) {
  let s = 'x^3';
  if (a !== 0) s += (a > 0 ? ' + ' : ' - ') + (Math.abs(a) === 1 ? '' : Math.abs(a)) + 'x^2';
  s += linX(b);
  if (typeof c === 'number') s += constC(c);
  else if (c) s += ' + ' + c;
  return s;
}

function fr(n, d = 1) {
  if (d === 0) throw new BuildError('zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

function decOf(n, d) {
  if (d === 0) return NaN;
  return Number((n / d).toFixed(4));
}

function acc(n, d = 1) {
  const s = fr(n, d);
  const out = [s];
  if (d !== 1) {
    const dec = decOf(n, d);
    const ds = String(dec);
    if (!out.includes(ds)) out.push(ds);
  }
  return out;
}

/* ---------------- item assembly ---------------- */

const TAGS = new Set(['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none']);

function makeItem(spec, difficulty, type, id) {
  if (!spec) return null;
  if (type === 'spr' && spec.mcqOnly) return null;
  const base = {
    id,
    section: 'math',
    domain: 'Advanced Math',
    skill: spec.skill,
    difficulty,
    type,
    stem: spec.stem,
  };
  if (type === 'mcq') {
    if (!Array.isArray(spec.wrong) || spec.wrong.length !== 3) return null;
    const pool = [
      { text: spec.correct, note: 'correct', tag: 'none', ok: true },
      ...spec.wrong.map((w) => ({ text: w.text, note: w.note, tag: w.tag, ok: false })),
    ];
    for (const p of pool) {
      if (typeof p.text !== 'string' || p.text.length === 0) return null;
      if (!TAGS.has(p.tag)) return null;
    }
    if (new Set(pool.map((p) => p.text)).size !== 4) return null;
    const sh = shuffle(pool);
    base.choices = sh.map((p) => p.text);
    base.answer = 'ABCD'[sh.findIndex((p) => p.ok)];
    base.choice_notes = sh.map((p) => p.note);
    base.error_tags = sh.map((p) => p.tag);
  } else {
    if (!Array.isArray(spec.spr) || spec.spr.length === 0) return null;
    if (new Set(spec.spr).size !== spec.spr.length) return null;
    base.accepted_spr = spec.spr;
  }
  base.explanation = spec.explanation;
  base.desmos = spec.desmos;
  base.skill_note = spec.skill_note;
  base.check = spec.check;
  const probe = JSON.stringify(base);
  if (/NaN|Infinity|undefined/.test(probe)) return null;
  return base;
}

/* ============================================================
   FAMILIES
   ============================================================ */

// 1. Quadratic equations by factoring (monic)
function fFactorMonic(d, type) {
  const lim = [5, 6, 8, 10, 12][d];
  const p = nz(lim);
  const q = nz(lim);
  if (p === q || p === -q) return null;
  const b = -(p + q);
  const c = p * q;
  need(p * p + b * p + c === 0 && q * q + b * q + c === 0, 'roots');
  need(c === p * q && b === -(p + q), 'vieta');
  const skill = 'Quadratic equations by factoring';
  const desmos = `y=${poly(1, b, c)}`;
  const hi = Math.max(p, q);
  if (type === 'spr') {
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=${poly(1, b, c)}$. What is the greater of the two solutions to $f(x)=0$?`,
      correct: String(hi),
      wrong: [],
      spr: [String(hi)],
      explanation: `Factor: $${poly(1, b, c)}=${fac(p)}${fac(q)}$, so the solutions are $x=${p}$ and $x=${q}$. The greater of the two is $${hi}$.`,
      desmos,
      skill_note: 'Factoring gives each root with the opposite sign of the constant in its factor; do not forget to compare the two values at the end.',
      check: `substituted x=${p} and x=${q} into ${poly(1, b, c)} (both 0) and expanded ${fac(p)}${fac(q)} to confirm coefficients ${b}, ${c}.`,
    };
  }
  if (chance(0.3)) {
    const forms = [
      `$${poly(1, b, c)}$`,
      `$${poly(1, -b, c)}$`,
      `$${poly(1, b, -c)}$`,
      `$${poly(1, -b, -c)}$`,
    ];
    if (new Set(forms).size !== 4) return null;
    return {
      skill,
      stem: `Which expression is equivalent to ${fac(p)}${fac(q)}?`,
      correct: forms[0],
      wrong: [
        { text: forms[1], note: 'flipped the sign of the linear term', tag: 'sign' },
        { text: forms[2], note: 'flipped the sign of the constant term', tag: 'sign' },
        { text: forms[3], note: 'flipped both signs', tag: 'sign' },
      ],
      explanation: `Expanding: $${fac(p)}${fac(q)}=${poly(1, b, c)}$. The sum of the roots is $${p + q}$ and the product is $${c}$, so the linear coefficient is $${b}$.`,
      desmos,
      skill_note: 'Multiply the binomials and combine like terms; the constant is the product of the two constants.',
      check: `expanded ${fac(p)}${fac(q)} term by term to ${poly(1, b, c)} and confirmed the other three forms differ in at least one coefficient.`,
    };
  }
  return {
    skill,
    stem: `The function $f$ is defined by $f(x)=${poly(1, b, c)}$. What are the solutions to $f(x)=0$?`,
    correct: pairText(p, q),
    wrong: [
      { text: pairText(-p, -q), note: 'flipped the sign of both roots', tag: 'sign' },
      { text: pairText(p, -q), note: 'flipped the sign of only one root', tag: 'sign' },
      { text: pairText(p + q, p * q), note: 'read the coefficients as the solutions', tag: 'concept' },
    ],
    explanation: `Since $${poly(1, b, c)}=${fac(p)}${fac(q)}$, the zero product property gives $x=${p}$ or $x=${q}$.`,
    desmos,
    skill_note: 'The constant inside each factor is the opposite of the root it produces.',
    check: `substituted both roots into ${poly(1, b, c)} (both 0) and expanded the factored form to match b=${b}, c=${c}.`,
  };
}

// 2. Factoring with a leading coefficient
function fFactorLead(d, type) {
  const a = pick(d < 2 ? [2, 3] : [2, 3, 4, 5]);
  const lim = [4, 5, 6, 7, 8][d];
  const r = nz(lim);
  const s = nz(lim);
  if (r === s || r === -s) return null;
  const A = a;
  const B = -a * (r + s);
  const C = a * r * s;
  need(A * r * r + B * r + C === 0 && A * s * s + B * s + C === 0, 'roots');
  const skill = 'Factoring with a leading coefficient';
  const desmos = `y=${poly(A, B, C)}`;
  const hi = Math.max(r, s);
  if (type === 'spr') {
    return {
      skill,
      stem: `What is the greater solution to the equation $${poly(A, B, C)}=0$?`,
      correct: String(hi),
      wrong: [],
      spr: [String(hi)],
      explanation: `Factor out $${a}$: $${poly(A, B, C)}=${a}${fac(r)}${fac(s)}$. The solutions are $x=${r}$ and $x=${s}$, so the greater one is $${hi}$.`,
      desmos,
      skill_note: 'The leading coefficient multiplies the whole product; it does not change the roots.',
      check: `evaluated the polynomial at x=${r} and x=${s} (both 0) and expanded ${a}${fac(r)}${fac(s)} back to A=${A}, B=${B}, C=${C}.`,
    };
  }
  return {
    skill,
    stem: `What are the solutions to the equation $${poly(A, B, C)}=0$?`,
    correct: pairText(r, s),
    wrong: [
      { text: pairText(-r, -s), note: 'flipped the sign of both roots', tag: 'sign' },
      { text: `$x=${fr(r, a)}$ and $x=${fr(s, a)}$`, note: 'divided the roots by the leading coefficient', tag: 'algebra' },
      { text: pairText(r + s, r * s), note: 'used the sum and product as the solutions', tag: 'concept' },
    ],
    explanation: `Write $${poly(A, B, C)}=${a}${fac(r)}${fac(s)}$, so the solutions are $x=${r}$ and $x=${s}$. The factor $${a}$ does not create extra solutions.`,
    desmos,
    skill_note: 'A leading coefficient scales the parabola but leaves the x-intercepts unchanged.',
    check: `substituted x=${r} and x=${s} into the expanded form (both 0); expansion of ${a}${fac(r)}${fac(s)} matches B=${B}, C=${C}.`,
  };
}

// 3. Quadratic formula (MCQ only)
function fQuadFormula(d, type) {
  if (type === 'spr') return null;
  const skill = 'Quadratic formula';
  if (d <= 1) {
    const a = pick([2, 3]);
    const u = pick([1, 5, 7]);
    const r = nz(5);
    if (r === 0) return null;
    // (a x + u)(x + r) = a x^2 + (a r + u) x + u r
    const A = a;
    const B = a * r + u;
    const C = u * r;
    need(Math.abs(A * (-u / a) ** 2 + B * (-u / a) + C) < 1e-9, 'root1');
    need(A * -r * -r + B * -r + C === 0, 'root2');
    const r1 = fr(-u, a);
    const r2 = String(-r);
    return {
      skill,
      stem: `What are the solutions to the equation $${poly(A, B, C)}=0$?`,
      correct: `$x=${r1}$ and $x=${r2}$`,
      wrong: [
        { text: `$x=${fr(u, a)}$ and $x=${r}$`, note: 'dropped the negative signs after applying the formula', tag: 'sign' },
        { text: `$x=${fr(-u, 1)}$ and $x=${r2}$`, note: 'did not divide by the leading coefficient', tag: 'algebra' },
        { text: `$x=${fr(u, a)}$ and $x=${-r}$`, note: 'sign error inside the formula', tag: 'sign' },
      ],
      explanation: `Here $a=${A}$, $b=${B}$, $c=${C}$, so the discriminant is $(${B})^2-4(${A})(${C})=${B * B - 4 * A * C}$. The formula gives $x=\\frac{${-B}\\pm\\sqrt{${B * B - 4 * A * C}}}{2(${A})}$, which simplifies to $x=${r1}$ and $x=${r2}$.`,
      desmos: `y=${poly(A, B, C)}`,
      skill_note: 'Keep the leading coefficient in the denominator of the formula; each root of $(ax+u)(x+r)$ is $-u/a$ or $-r$.',
      check: `substituted both reported roots into ${poly(A, B, C)} (0 each) and confirmed the discriminant ${B * B - 4 * A * C} is a perfect square.`,
    };
  }
  // irrational roots: (x-h)^2 = k, k not a perfect square
  const h = nz(d >= 3 ? 7 : 5);
  let k = pick(d >= 3 ? [2, 3, 5, 6, 7, 10, 11] : [2, 3, 5, 7]);
  const B = -2 * h;
  const C = h * h - k;
  need(B * B - 4 * C === 4 * k && Number.isInteger(Math.sqrt(4 * k)) === false, 'disc');
  return {
    skill,
    stem: `What are the solutions to the equation $x^2${B >= 0 ? '+' : '-'}${Math.abs(B)}x${C >= 0 ? '+' : '-'}${Math.abs(C)}=0$?`,
    correct: `$x=${h}\\pm\\sqrt{${k}}$`,
    wrong: [
      { text: `$x=${-h}\\pm\\sqrt{${k}}$`, note: 'used the wrong sign for the center of the solutions', tag: 'sign' },
      { text: `$x=${h}\\pm${k}$`, note: 'forgot the square root when undoing the square', tag: 'algebra' },
      { text: `$x=${-h}\\pm${k}$`, note: 'made both errors at once', tag: 'sign' },
    ],
    explanation: `Complete the square: $x^2${B >= 0 ? '+' : '-'}${Math.abs(B)}x=${k + h * h}$ means $(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2=${k}$. Taking square roots gives $x=${h}\\pm\\sqrt{${k}}$.`,
    desmos: `y=x^2${B >= 0 ? '+' : '-'}${Math.abs(B)}x${C >= 0 ? '+' : '-'}${Math.abs(C)}`,
    skill_note: 'When the discriminant is not a perfect square, the answer keeps a radical; the center comes from $-b/(2a)$ with its original sign.',
    check: `completed the square independently and substituted back symbolically; discriminant ${4 * k} is not a perfect square, so exactly two irrational roots.`,
  };
}

// 4. Completing the square
function fCompleteSquare(d, type) {
  const b = pick([-10, -8, -6, -4, 4, 6, 8, 10, 12]);
  const c = nz([6, 8, 10, 12, 15][d]);
  const h = b / 2;
  const k = c - h * h;
  need(Math.abs(k) <= 120, 'k');
  need((1 * h * h + k) === c, 'expand');
  const skill = 'Completing the square';
  const desmos = `y=${poly(1, b, c)}`;
  if (type === 'spr' && d >= 2) {
    const n = h * h;
    return {
      skill,
      stem: `What value of $n$ makes $${poly(1, b, 0)} + n$ a perfect square trinomial?`,
      correct: String(n),
      wrong: [],
      spr: [String(n)],
      explanation: `A perfect square needs $n=\\left(\\frac{${b}}{2}\\right)^2=${n}$. Then $${poly(1, b, n)}=(x${constC(h)})^2$.`,
      desmos,
      skill_note: 'Half the linear coefficient, squared — the sign of b disappears because of the squaring.',
      check: `expanded (x${h >= 0 ? '+' : '-'}${Math.abs(h)})^2 and confirmed the x-coefficient ${b} and constant ${n}.`,
    };
  }
  return {
    skill,
    stem: `The expression $${poly(1, b, c)}$ can be written in the form $(x+h)^2+k$. What is the value of $k$?`,
    correct: String(k),
    wrong: [
      { text: String(c), note: 'kept the original constant instead of adjusting it', tag: 'concept' },
      { text: String(-h), note: 'reported the shift instead of the constant', tag: 'misread' },
      { text: String(k + 2 * h * h), note: 'added the squared half-coefficient instead of subtracting it', tag: 'sign' },
    ],
    explanation: `Half of $${b}$ is $${h}$, and $${h}^2=${h * h}$. So $${poly(1, b, c)}=(x${h >= 0 ? '+' : '-'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)}$, giving $k=${k}$.`,
    desmos,
    skill_note: 'Completing the square adds and subtracts (b/2)^2, so the new constant is c - (b/2)^2.',
    check: `expanded (x${h >= 0 ? '+' : '-'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)} and recovered b=${b}, c=${c}.`,
  };
}

// 5. Vertex form of a quadratic
function fVertexForm(d, type) {
  const a = pick([-5, -4, -3, -2, 2, 3, 4, 5]);
  const h = nz([4, 5, 7, 8, 9][d]);
  const k = nz([5, 6, 8, 9, 12][d]);
  const Bv = -2 * a * h;
  const Cv = a * h * h + k;
  need(Bv === -2 * a * h && Cv - a * h * h === k, 'vertex expansion');
  need(-Bv / (2 * a) === h, 'vertex x');
  const skill = 'Vertex form of a quadratic';
  const expr = `y=${a}(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)}`;
  const vx = `${a > 0 ? 'minimum' : 'maximum'}`;
  if (type === 'spr') {
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=${a}(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)}$. What is the ${vx} value of $f(x)$?`,
      correct: String(k),
      wrong: [],
      spr: [String(k)],
      explanation: `In vertex form $a(x-h)^2+k$ the vertex is $(h,k)=(${h},${k})$. Because $a=${a}${a > 0 ? '>0' : '<0'}, the ${vx} value of the function is the y-coordinate $${k}$.`,
      desmos: expr,
      skill_note: 'The extreme value is k, not h — h locates where it happens.',
      check: `expanded to standard form and computed the vertex as (-b/(2a), c-b^2/(4a)); both gave (${h}, ${k}).`,
    };
  }
  return {
    skill,
    stem: `The function $f$ is defined by $f(x)=${a}(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)}$. What are the coordinates of the vertex of the graph of $y=f(x)$?`,
    correct: `$(${h},${k})$`,
    wrong: [
      { text: `$(${-h},${k})$`, note: 'flipped the sign of h inside the parentheses', tag: 'sign' },
      { text: `$(${h},${-k})$`, note: 'flipped the sign of the vertical shift', tag: 'sign' },
      { text: `$(${-h},${-k})$`, note: 'flipped both signs', tag: 'sign' },
    ],
    explanation: `Vertex form $a(x-h)^2+k$ has vertex $(h,k)$. Here $h=${h}$ and $k=${k}$, so the vertex is $(${h},${k})$.`,
    desmos: expr,
    skill_note: 'The number inside the parentheses is subtracted from x, so the vertex x-coordinate is its opposite.',
    check: `computed -b/(2a) from the expanded form and matched it to h=${h}, then evaluated f(${h})=${k}.`,
  };
}

// 6. Vertex from standard form
function fVertexStandard(d, type) {
  const a = pick([-3, -2, 2, 3]);
  const h = nz([4, 5, 6, 8, 9][d]);
  const k = nz([6, 7, 9, 10, 12][d]);
  const B = -2 * a * h;
  const C = a * h * h + k;
  need(-B / (2 * a) === h, 'axis');
  need(C - (a * h * h) === k, 'vertexY');
  need(Math.abs(B) <= 60 && Math.abs(C) <= 90, 'size');
  const skill = 'Vertex from standard form';
  const desmos = `y=${poly(a, B, C)}`;
  if (type === 'spr') {
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=${poly(a, B, C)}$. What is the ${a > 0 ? 'minimum' : 'maximum'} value of $f(x)$?`,
      correct: String(k),
      wrong: [],
      spr: [String(k)],
      explanation: `The vertex x-coordinate is $-\\frac{b}{2a}=-\\frac{${B}}{2(${a})}=${h}$. Substituting gives $f(${h})=${k}$, so the ${a > 0 ? 'minimum' : 'maximum'} value is $${k}$.`,
      desmos,
      skill_note: 'Find the vertex x-coordinate first, then substitute it back — the extreme value is the output, not the input.',
      check: `computed the vertex as (-b/(2a), c-b^2/(4a)) = (${h}, ${k}) and confirmed by completing the square.`,
    };
  }
  return {
    skill,
    stem: `The function $f$ is defined by $f(x)=${poly(a, B, C)}$. What are the coordinates of the vertex of the graph of $y=f(x)$?`,
    correct: `$(${h},${k})$`,
    wrong: [
      { text: `$(${-h},${k})$`, note: 'dropped the negative sign in -b/(2a)', tag: 'sign' },
      { text: `$(${h},${-k})$`, note: 'flipped the sign of the extreme value', tag: 'sign' },
      { text: `$(${B},${C})$`, note: 'used the coefficients as the vertex', tag: 'concept' },
    ],
    explanation: `The vertex x-coordinate is $-\\frac{b}{2a}=-\\frac{${B}}{2(${a})}=${h}$, and $f(${h})=${k}$. So the vertex is $(${h},${k})$.`,
    desmos,
    skill_note: 'In standard form the vertex is not (b, c); use -b/(2a) and substitute.',
    check: `verified f(${h})=${k}, f(${h}+1)=${a + k} and f(${h}-1)=${a + k}, confirming symmetry about x=${h}.`,
  };
}

// 7. Axis of symmetry
function fAxis(d, type) {
  const a = pick([1, 1, 2, -1, -2]);
  const base = nz([5, 7, 8, 9, 11][d]);
  const off = pick([1, 2, 3, 4, 5]);
  const r = base - off;
  const s = base + off;
  if (r === 0 || s === 0 || r === s) return null;
  const B = -a * (r + s);
  const C = a * r * s;
  const axis = (r + s) / 2;
  need(Number.isInteger(axis), 'axis int');
  need(-B / (2 * a) === axis, 'axis');
  const skill = 'Axis of symmetry';
  const desmos = `y=${poly(a, B, C)}`;
  if (type === 'spr') {
    return {
      skill,
      stem: `The graph of $y=${poly(a, B, C)}$ is a parabola. What is the $x$-coordinate of its axis of symmetry?`,
      correct: String(axis),
      wrong: [],
      spr: [String(axis)],
      explanation: `The axis of symmetry is $x=-\\frac{b}{2a}=-\\frac{${B}}{2(${a})}=${axis}$. Equivalently it is the midpoint of the two roots $${r}$ and $${s}$.`,
      desmos,
      skill_note: 'The axis of symmetry is the midpoint of the roots and also -b/(2a); both give the same x.',
      check: `computed the midpoint of roots (${r}+${s})/2=${axis} and -b/(2a)=${axis}; they agree.`,
    };
  }
  return {
    skill,
    stem: `The graph of $y=${poly(a, B, C)}$ is a parabola in the $xy$-plane. Which equation gives its axis of symmetry?`,
    correct: `$x=${axis}$`,
    wrong: [
      { text: `$y=${axis}$`, note: 'gave a horizontal line instead of a vertical one', tag: 'concept' },
      { text: `$x=${-axis}$`, note: 'flipped the sign of the axis', tag: 'sign' },
      { text: `$x=${r + s}$`, note: 'used the sum of the roots instead of the midpoint', tag: 'algebra' },
    ],
    explanation: `The roots are $x=${r}$ and $x=${s}$, so the axis of symmetry is halfway between them: $x=\\frac{${r}+(${s})}{2}=${axis}$. The formula $-\\frac{b}{2a}$ gives the same value.`,
    desmos,
    skill_note: 'An axis of symmetry is a vertical line, so it must be written x = constant.',
    check: `checked f(${axis}+t)=f(${axis}-t) numerically for t=1 and t=2, and matched -b/(2a).`,
  };
}

// 8. Discriminant
function fDiscriminant(d, type) {
  const skill = 'The discriminant';
  if (d >= 3 && type === 'spr') {
    // exactly one real solution: x^2 + kx + c, c = m^2, k = 2m
    const m = ri(3, 9);
    const c = m * m;
    const kPos = 2 * m;
    need(kPos * kPos - 4 * c === 0, 'double root');
    return {
      skill,
      stem: `The equation $x^2+kx+${c}=0$ has exactly one real solution. What is the positive value of $k$?`,
      correct: String(kPos),
      wrong: [],
      spr: [String(kPos)],
      explanation: `Exactly one real solution means the discriminant is zero: $k^2-4(${c})=0$, so $k^2=${4 * c}$ and $k=\\pm${kPos}$. The positive value is $${kPos}$.`,
      desmos: `y=x^2+${kPos}x+${c}`,
      skill_note: 'One solution means discriminant exactly zero, not negative.',
      check: `substituted k=${kPos}: discriminant ${kPos}^2-4(${c})=0, and the trinomial factors as (x+${m})^2.`,
    };
  }
  if (d >= 3) {
    const m = ri(2, 7);
    const c = m * m;
    const kPos = 2 * m;
    return {
      skill,
      stem: `For which values of $k$ does the equation $x^2+kx+${c}=0$ have no real solutions?`,
      correct: `$-${kPos}<k<${kPos}$`,
      wrong: [
        { text: `$k<-${kPos}$ or $k>${kPos}$`, note: 'used the region where the discriminant is positive', tag: 'concept' },
        { text: `$-${c}<k<${c}$`, note: 'compared k^2 with c instead of 4c', tag: 'algebra' },
        { text: `$k>${kPos}$`, note: 'kept only half of the interval', tag: 'misread' },
      ],
      explanation: `No real solutions means $k^2-4(${c})<0$, so $k^2<${4 * c}$ and $|k|<${kPos}$. That is $-${kPos}<k<${kPos}$.`,
      desmos: `y=x^2+${kPos}x+${c}`,
      skill_note: 'A negative discriminant gives no real roots; solve the inequality in |k|, not in k.',
      check: `tested k=0 (discriminant ${-4 * c} < 0, no roots) and k=${kPos} (discriminant 0, one root) to confirm the open interval.`,
    };
  }
  const kind = pick(['two', 'one', 'zero']);
  let a = 1;
  let b = 0;
  let cc = 0;
  if (kind === 'two') {
    a = pick([1, 2]);
    const r = nz(6);
    const s = nz(6);
    if (r === s) return null;
    b = -a * (r + s);
    cc = a * r * s;
  } else if (kind === 'one') {
    a = pick([1, 2]);
    const r = nz(6);
    b = -2 * a * r;
    cc = a * r * r;
  } else {
    a = pick([1, 2]);
    b = nz(6);
    const minC = Math.floor((b * b) / (4 * a)) + 1;
    cc = minC + ri(0, 5);
  }
  const D = b * b - 4 * a * cc;
  need((kind === 'two' && D > 0) || (kind === 'one' && D === 0) || (kind === 'zero' && D < 0), 'D sign');
  const count = D > 0 ? 2 : D === 0 ? 1 : 0;
  if (type === 'spr') {
    return {
      skill,
      stem: `How many distinct real solutions does $${poly(a, b, cc)}=0$ have?`,
      correct: String(count),
      wrong: [],
      spr: [String(count)],
      explanation: `The discriminant is $b^2-4ac=${b}^2-4(${a})(${cc})=${D}$. ${D > 0 ? 'A positive discriminant gives two distinct real solutions.' : D === 0 ? 'A zero discriminant gives exactly one real solution.' : 'A negative discriminant gives no real solutions.'}`,
      desmos: `y=${poly(a, b, cc)}`,
      skill_note: 'Count real solutions from the sign of b^2-4ac, not from how the trinomial looks.',
      check: `computed the discriminant as ${D} and confirmed with the vertex form: the minimum value is ${(4 * a * cc - b * b) / (4 * a)}.`,
    };
  }
  return {
    skill,
    stem: `How many distinct real solutions does the equation $${poly(a, b, cc)}=0$ have?`,
    correct: String(count),
    wrong: [0, 1, 2, 4]
      .filter((v) => v !== count)
      .slice(0, 3)
      .map((v) => ({
        text: String(v),
        note:
          v === 0
            ? 'concluded there are no real solutions'
            : v === 1
              ? 'counted a repeated root twice or saw one root'
              : v === 4
                ? 'counted the degree instead of the real solutions'
                : 'misjudged the sign of the discriminant',
        tag: 'concept',
      })),
    explanation: `The discriminant is $${b}^2-4(${a})(${cc})=${D}$. ${D > 0 ? 'Positive, so there are two distinct real solutions.' : D === 0 ? 'Zero, so there is exactly one real solution.' : 'Negative, so there are no real solutions.'}`,
    desmos: `y=${poly(a, b, cc)}`,
    skill_note: 'The discriminant decides the number of real solutions before you solve anything.',
    check: `evaluated the discriminant ${D} and checked the graph's vertex y-value ${(4 * a * cc - b * b) / (4 * a)} has the matching sign.`,
  };
}

// 9. Sum and product of roots
function fSumProduct(d, type) {
  const a = d >= 3 ? pick([2, 3]) : 1;
  const lim = [5, 6, 7, 8, 9][d];
  const r = nz(lim);
  const s = nz(lim);
  if (r === s || r === -s) return null;
  const B = -a * (r + s);
  const C = a * r * s;
  const sum = r + s;
  const prod = r * s;
  need(-B / a === sum && C / a === prod, 'vieta');
  const skill = 'Sum and product of roots';
  const desmos = `y=${poly(a, B, C)}`;
  const modes = ['sum', 'product', 'squares', 'recip', 'diffsq'];
  const mode = modes[Math.min(d, 4)];
  if (mode === 'sum' || mode === 'product') {
    const val = mode === 'sum' ? sum : prod;
    const label = mode === 'sum' ? 'sum' : 'product';
    if (type === 'spr') {
      return {
        skill,
        stem: `The equation $${poly(a, B, C)}=0$ has solutions $r$ and $s$. What is the ${label} of the solutions?`,
        correct: String(val),
        wrong: [],
        spr: [String(val)],
        explanation: `By Vieta's formulas, the ${label} is ${mode === 'sum' ? `$-\\frac{b}{a}=-\\frac{${B}}{${a}}=${sum}` : `$\\frac{c}{a}=\\frac{${C}}{${a}}=${prod}`}$.`,
        desmos,
        skill_note: mode === 'sum' ? 'The sum of roots is -b/a; the sign of b matters.' : 'The product of roots is c/a; with a negative constant the product is negative.',
        check: `solved the equation by factoring (${fac(r)}${fac(s)}) and confirmed the ${label} directly: ${val}.`,
      };
    }
    return {
      skill,
      stem: `The equation $${poly(a, B, C)}=0$ has solutions $r$ and $s$. What is the ${label} of these solutions?`,
      correct: String(val),
      wrong: [
        { text: String(-val), note: 'used the opposite sign', tag: 'sign' },
        { text: String(mode === 'sum' ? prod : sum), note: 'swapped sum and product', tag: 'concept' },
        { text: String(mode === 'sum' ? B : C), note: 'read the coefficient without dividing by a', tag: 'algebra' },
      ],
      explanation: `Vieta's formulas give ${mode === 'sum' ? `$r+s=-\\frac{b}{a}=-\\frac{${B}}{${a}}=${sum}` : `$rs=\\frac{c}{a}=\\frac{${C}}{${a}}=${prod}`}$. Factoring confirms the roots $${r}$ and $${s}$.`,
      desmos,
      skill_note: 'Divide by the leading coefficient before reading the sum or product.',
      check: `factored to ${fac(r)}${fac(s)} and computed the ${label} directly; matches Vieta.`,
    };
  }
  if (mode === 'squares') {
    const v = sum * sum - 2 * prod;
    need(v === r * r + s * s, 'squares');
    return {
      skill,
      stem: `The equation $${poly(a, B, C)}=0$ has solutions $r$ and $s$. What is the value of $r^2+s^2$?`,
      correct: String(v),
      wrong: [
        { text: String(sum * sum), note: 'expanded (r+s)^2 without subtracting 2rs', tag: 'algebra' },
        { text: String(prod * prod), note: 'squared the product instead of summing squares', tag: 'concept' },
        { text: String(v - 2 * prod), note: 'subtracted 2rs twice', tag: 'arithmetic' },
      ],
      spr: [String(v)],
      explanation: `$r+s=${sum}$ and $rs=${prod}$, so $r^2+s^2=(r+s)^2-2rs=${sum * sum}-2(${prod})=${v}$. Using the identity is faster than solving for each root separately.`,
      desmos,
      skill_note: 'r^2+s^2 is (r+s)^2 - 2rs, not (r+s)^2.',
      check: `computed (${r})^2+(${s})^2 directly (=${v}) and via Vieta; both agree.`,
    };
  }
  if (mode === 'recip') {
    const n = sum;
    const dn = prod;
    const v = fr(n, dn);
    need(Math.abs(decOf(n, dn) - (1 / r + 1 / s)) < 1e-9, 'recip');
    return {
      skill,
      stem: `The equation $${poly(a, B, C)}=0$ has solutions $r$ and $s$. What is the value of $\\frac{1}{r}+\\frac{1}{s}$?`,
      correct: `$${v}$`,
      wrong: [
        { text: `$${fr(-n, dn)}$`, note: 'dropped the sign of the sum', tag: 'sign' },
        { text: `$${fr(dn, n)}$`, note: 'inverted the ratio', tag: 'algebra' },
        { text: `$${fr(n, 1)}$`, note: 'forgot to divide by the product', tag: 'concept' },
      ],
      spr: acc(n, dn),
      explanation: `$\\frac{1}{r}+\\frac{1}{s}=\\frac{r+s}{rs}=\\frac{${sum}}{${prod}}=${v}$.`,
      desmos,
      skill_note: 'Combine the reciprocals over a common denominator first; the result is (sum)/(product).',
      check: `computed 1/${r}+1/${s} directly as a fraction and compared with (r+s)/(rs)=${v}.`,
    };
  }
  const v = (r - s) * (r - s);
  return {
    skill,
    stem: `The equation $${poly(a, B, C)}=0$ has solutions $r$ and $s$. What is the value of $(r-s)^2$?`,
    correct: String(v),
    wrong: [
      { text: String(sum * sum - 2 * prod), note: 'computed r^2+s^2 instead', tag: 'misread' },
      { text: String(v + 4 * prod), note: 'added 4rs instead of subtracting', tag: 'sign' },
      { text: String(-v), note: 'reported a negative square', tag: 'concept' },
    ],
    spr: [String(v)],
    explanation: `$(r-s)^2=(r+s)^2-4rs=${sum * sum}-4(${prod})=${v}$. Equivalently, $|r-s|=${Math.abs(r - s)}$, whose square is $${v}$.`,
    desmos,
    skill_note: '(r-s)^2 is (r+s)^2 - 4rs; it is always nonnegative.',
    check: `computed (${r}-(${s}))^2 directly (=${v}) and via Vieta; both agree.`,
  };
}

// 10. Quadratic word problems: area
function fArea(d, type) {
  const skill = 'Quadratic word problems: area';
  const variant = pick(['fence4', 'fence3', 'dims']);
  if (variant === 'dims') {
    const w = ri(3, [8, 9, 10, 12, 14][d]);
    const k = ri(2, 6);
    const L = w + k;
    const A = w * L;
    need(w * (w + k) === A, 'area');
    need(w * w + k * w - A === 0, 'equation');
    if (type === 'spr') {
      return {
        skill,
        stem: `A rectangular garden has a length that is ${k} feet longer than its width. The area of the garden is ${A} square feet. What is the width, in feet?`,
        correct: String(w),
        wrong: [],
        spr: [String(w)],
        explanation: `With width $w$, the length is $w+${k}$ and $w(w+${k})=${A}$, so $w^2+${k}w-${A}=0$. This factors as $(w-${w})(w+${L})$, giving $w=${w}$ (the negative root is rejected).`,
        desmos: `y=x^2+${k}x-${A}`,
        skill_note: 'Length times width equals area; reject the negative root because a width cannot be negative.',
        check: `substituted w=${w}: ${w}(${w}+${k})=${A}, and the quadratic factors as $(w-${w})(w+${L})$.`,
      };
    }
    return {
      skill,
      stem: `A rectangular garden has a length that is ${k} feet longer than its width. The area of the garden is ${A} square feet. What are the dimensions of the garden?`,
      correct: `$${w}$ ft by $${L}$ ft`,
      wrong: [
        { text: `$${w}$ ft by $${w + k + 1}$ ft`, note: 'mis-set the length difference', tag: 'setup' },
        { text: `$${w - 1}$ ft by $${L + 1}$ ft`, note: 'shifted both sides by one foot', tag: 'arithmetic' },
        { text: `$${w + 1}$ ft by $${L - 1}$ ft`, note: 'shifted both sides in the wrong direction', tag: 'arithmetic' },
      ],
      explanation: `Solve $w(w+${k})=${A}$, i.e. $w^2+${k}w-${A}=0$, which factors as $(w-${w})(w+${L})$. The positive root is $w=${w}$, so the length is $${L}$.`,
      desmos: `y=x^2+${k}x-${A}`,
      skill_note: 'Check both dimensions against the stated difference and the area.',
      check: `verified ${w}×${L}=${A} and ${L}-${w}=${k}.`,
    };
  }
  if (variant === 'fence4') {
    const m = ri([6, 8, 10, 12, 15][d], [9, 11, 13, 15, 18][d]);
    const P = 4 * m;
    const maxA = m * m;
    need((P / 4) * (P / 4) === maxA, 'maxA');
    need((m - 1) * (P / 2 - (m - 1)) < maxA && (m + 1) * (P / 2 - (m + 1)) < maxA, 'area max');
    if (type === 'spr') {
      return {
        skill,
        stem: `A rectangular dog run is enclosed with ${P} feet of fencing on all four sides. What is the greatest possible area of the run, in square feet?`,
        correct: String(maxA),
        wrong: [],
        spr: [String(maxA)],
        explanation: `With width $w$ and length $${P / 2}-w$, the area is $w(${P / 2}-w)=-w^2+${P / 2}w$. This parabola peaks at $w=${m}$, giving area $${m}^2=${maxA}$.`,
        desmos: `y=x(${P / 2}-x)`,
        skill_note: 'For a fixed perimeter the rectangle with the greatest area is a square.',
        check: `checked w=${m - 1} (${(m - 1) * (P / 2 - (m - 1))}) and w=${m} (${maxA}) and w=${m + 1} (${(m + 1) * (P / 2 - (m + 1))}); the middle is largest.`,
      };
    }
    return {
      skill,
      stem: `A rectangular dog run is enclosed with ${P} feet of fencing on all four sides. What dimensions give the greatest possible area?`,
      correct: `$${m}$ ft by $${m}$ ft`,
      wrong: [
        { text: `$${m - 2}$ ft by $${m + 2}$ ft`, note: 'used unequal sides with the same perimeter', tag: 'concept' },
        { text: `$${P / 2}$ ft by $${P / 2}$ ft`, note: 'used half the perimeter for each side', tag: 'setup' },
        { text: `$${m}$ ft by $${2 * m}$ ft`, note: 'used w and 2w instead of a square', tag: 'algebra' },
      ],
      explanation: `Area $=w(${P / 2}-w)$ is maximized at the vertex $w=\\frac{${P / 2}}{2}=${m}$, making the run a $${m}$ by $${m}$ square.`,
      desmos: `y=x(${P / 2}-x)`,
      skill_note: 'Equal sides maximize area for a fixed perimeter.',
      check: `verified ${m}×${m}=${maxA} and that ${m - 2}×${m + 2}=${maxA - 4} is smaller.`,
    };
  }
  const m = ri([5, 6, 7, 8, 9][d], [8, 9, 10, 12, 14][d]);
  const P = 4 * m;
  const width = m;
  const length = 2 * m;
  const maxA = width * length;
  need(width + width + length === P && maxA === 2 * m * m, 'pen');
  if (type === 'spr') {
    return {
      skill,
      stem: `A rectangular pen is built against a barn using ${P} feet of fencing for the other three sides. What is the greatest possible area of the pen, in square feet?`,
      correct: String(maxA),
      wrong: [],
      spr: [String(maxA)],
      explanation: `If the two sides perpendicular to the barn have length $x$, the side parallel to the barn is $${P}-2x$, so area $=x(${P}-2x)$. The vertex is at $x=\\frac{${P}}{4}=${width}$, giving area $${width}\\cdot${length}=${maxA}$.`,
      desmos: `y=x(${P}-2x)`,
      skill_note: 'With only three fenced sides, the parallel side gets twice the width at the maximum.',
      check: `checked x=${width - 1} (${(width - 1) * (P - 2 * (width - 1))}) and x=${width + 1} (${(width + 1) * (P - 2 * (width + 1))}); both are below ${maxA}.`,
    };
  }
  return {
    skill,
    stem: `A rectangular pen is built against a barn using ${P} feet of fencing for the other three sides. What width (the sides perpendicular to the barn) maximizes the area?`,
    correct: `$${width}$ ft`,
    wrong: [
      { text: `$${length}$ ft`, note: 'used the parallel side length', tag: 'misread' },
      { text: `$${P / 2}$ ft`, note: 'split the fencing into two equal sides only', tag: 'setup' },
      { text: `$${P}$ ft`, note: 'used the whole fencing length for one side', tag: 'setup' },
    ],
    explanation: `Area $=x(${P}-2x)$ has its vertex at $x=\\frac{${P}}{4}=${width}$, so the width is $${width}$ feet (and the parallel side is $${length}$ feet).`,
    desmos: `y=x(${P}-2x)`,
    skill_note: 'Three-sided fencing: the parallel side equals P - 2x, so the maximum splits the fencing 1:2.',
    check: `confirmed ${width}+${width}+${length}=${P} and that the vertex x=${P}/4=${width}.`,
  };
}

// 11. Projectile motion
function fProjectile(d, type) {
  const k = ri(2, [4, 5, 6, 7, 8][d]);
  const m = ri(1, 5);
  const v0 = 32 * k;
  const T = 2 * k + m;
  const h0 = 16 * T * (T - 2 * k);
  need(h0 > 0, 'h0');
  const maxH = h0 + 16 * k * k;
  need(-16 * k * k + v0 * k + h0 === maxH, 'peak');
  need(-16 * T * T + v0 * T + h0 === 0, 'ground');
  const skill = 'Projectile motion';
  const desmos = `y=-16x^2+${v0}x+${h0}`;
  const which = type === 'spr' ? pick(['max', 'ground', 'time']) : pick(['max', 'time', 'ground']);
  if (which === 'max') {
    if (type === 'spr') {
      return {
        skill,
        stem: `A ball is thrown upward from a height of ${h0} feet with an initial velocity of ${v0} feet per second. Its height after $t$ seconds is $h(t)=-16t^2+${v0}t+${h0}$. What is the maximum height the ball reaches, in feet?`,
        correct: String(maxH),
        wrong: [],
        spr: [String(maxH)],
        explanation: `The vertex is at $t=\\frac{${v0}}{32}=${k}$ seconds, and $h(${k})=-16(${k})^2+${v0}(${k})+${h0}=${maxH}$.`,
        desmos,
        skill_note: 'For -16t^2+v0t+h0 the peak time is v0/32; substitute it back for the height.',
        check: `evaluated h at t=${k - 1} (${-16 * (k - 1) ** 2 + v0 * (k - 1) + h0}) and t=${k + 1} (${-16 * (k + 1) ** 2 + v0 * (k + 1) + h0}); both are less than ${maxH}.`,
      };
    }
    return {
      skill,
      stem: `A ball is thrown upward from a height of ${h0} feet with an initial velocity of ${v0} feet per second. Its height after $t$ seconds is $h(t)=-16t^2+${v0}t+${h0}$. What is the maximum height the ball reaches?`,
      correct: `$${maxH}$ feet`,
      wrong: [
        { text: `$${h0}$ feet`, note: 'used the starting height', tag: 'setup' },
        { text: `$${16 * k * k}$ feet`, note: 'reported only the height gained', tag: 'concept' },
        { text: `$${h0 + 32 * k * k}$ feet`, note: 'doubled the gain from the initial velocity', tag: 'algebra' },
      ],
      explanation: `The peak occurs at $t=${k}$ seconds, and $h(${k})=${maxH}$. So the maximum height is $${maxH}$ feet.`,
      desmos,
      skill_note: 'The maximum height includes the launch height h0; do not report only the gain.',
      check: `completed the square: h(t)=-16(t-${k})^2+${maxH}.`,
    };
  }
  if (which === 'time') {
    return {
      skill,
      stem: `A ball is thrown upward from a height of ${h0} feet with an initial velocity of ${v0} feet per second. Its height after $t$ seconds is $h(t)=-16t^2+${v0}t+${h0}$. After how many seconds does the ball reach its maximum height?`,
      correct: `$${k}$ seconds`,
      wrong: [
        { text: `$${v0}$ seconds`, note: 'used the initial velocity as the time', tag: 'concept' },
        { text: `$${T}$ seconds`, note: 'gave the time it lands instead', tag: 'misread' },
        { text: `$${maxH}$ seconds`, note: 'used the maximum height as the time', tag: 'unit' },
      ],
      spr: [String(k)],
      explanation: `The maximum height occurs at the vertex: $t=-\\frac{b}{2a}=-\\frac{${v0}}{2(-16)}=\\frac{${v0}}{32}=${k}$ seconds.`,
      desmos,
      skill_note: 'Time to the peak is -b/(2a), which is v0/32 for this model.',
      check: `confirmed h(${k - 1})=${-16 * (k - 1) ** 2 + v0 * (k - 1) + h0} < h(${k})=${maxH} > h(${k + 1})=${-16 * (k + 1) ** 2 + v0 * (k + 1) + h0}.`,
    };
  }
  if (type === 'spr') {
    return {
      skill,
      stem: `A ball is thrown upward from a height of ${h0} feet with an initial velocity of ${v0} feet per second. Its height after $t$ seconds is $h(t)=-16t^2+${v0}t+${h0}$. After how many seconds does the ball hit the ground?`,
      correct: String(T),
      wrong: [],
      spr: [String(T)],
      explanation: `Set $h(t)=0$: $-16t^2+${v0}t+${h0}=0$ divides by $-16$ to give $t^2-${2 * k}t-${h0 / 16}=0$, which factors as ${fac(T)}${fac(-(T - 2 * k))}. The positive solution is $t=${T}$.`,
      desmos,
      skill_note: 'Hitting the ground means h(t)=0; keep only the positive root.',
      check: `substituted t=${T}: -16(${T})^2+${v0}(${T})+${h0}=0.`,
    };
  }
  return {
    skill,
    stem: `A ball is thrown upward from a height of ${h0} feet with an initial velocity of ${v0} feet per second. Its height after $t$ seconds is $h(t)=-16t^2+${v0}t+${h0}$. After how many seconds does the ball hit the ground?`,
    correct: `$${T}$ seconds`,
    wrong: [
      { text: `$${k}$ seconds`, note: 'gave the time of the peak', tag: 'misread' },
      { text: `$${2 * k}$ seconds`, note: 'stopped at twice the peak time', tag: 'setup' },
      { text: `$${h0 / 16}$ seconds`, note: 'divided the starting height by 16 and stopped', tag: 'algebra' },
    ],
    explanation: `Solving $-16t^2+${v0}t+${h0}=0$ gives $t=${T}$ or $t=${-(T - 2 * k)}$. Since $t>0$, the ball lands after $${T}$ seconds.`,
    desmos,
    skill_note: 'The negative root of the height equation is discarded, not the positive one.',
    check: `factored the equation as -16${fac(T)}${fac(-(T - 2 * k))} and verified h(${T})=0.`,
  };
}

// 12. Revenue and maximum profit
function fRevenue(d, type) {
  const b = pick([2, 4, 5]);
  const m = ri([5, 8, 10, 12, 15][d], [15, 18, 20, 25, 30][d]);
  const a = 2 * b * m;
  const maxR = b * m * m;
  need(a * m - b * m * m === maxR, 'rev');
  need((m - 1) * (a - b * (m - 1)) < maxR && (m + 1) * (a - b * (m + 1)) < maxR, 'rev max');
  const skill = 'Revenue and maximum profit';
  const desmos = `y=x(${a}-${b}x)`;
  if (type === 'spr') {
    const ask = pick(['price', 'rev']);
    if (ask === 'price') {
      return {
        skill,
        stem: `A concert venue sells tickets at $p$ dollars each. At that price it sells $${a}-${b}p$ tickets. The revenue is $R(p)=p(${a}-${b}p)$. What ticket price maximizes revenue, in dollars?`,
        correct: String(m),
        wrong: [],
        spr: [String(m)],
        explanation: `$R(p)=-${b}p^2+${a}p$ is a parabola with vertex at $p=\\frac{${a}}{2(${b})}=${m}$. The revenue is greatest at $\\$${m}$ per ticket.`,
        desmos,
        skill_note: 'Revenue is price times quantity; its vertex gives the best price, not the largest quantity.',
        check: `compared R(${m - 1})=${(m - 1) * (a - b * (m - 1))}, R(${m})=${maxR}, R(${m + 1})=${(m + 1) * (a - b * (m + 1))}.`,
      };
    }
    return {
      skill,
      stem: `A concert venue sells tickets at $p$ dollars each. At that price it sells $${a}-${b}p$ tickets. The revenue is $R(p)=p(${a}-${b}p)$. What is the maximum possible revenue, in dollars?`,
      correct: String(maxR),
      wrong: [],
      spr: [String(maxR)],
      explanation: `The vertex occurs at $p=${m}$, so the maximum revenue is $R(${m})=${m}(${a}-${b}\\cdot${m})=${maxR}$ dollars.`,
      desmos,
      skill_note: 'Maximum revenue is R at the vertex price, not the price itself.',
      check: `checked the vertex value against R at p=${m - 1} and p=${m + 1}; ${maxR} is larger.`,
    };
  }
  if (chance(0.5)) {
    return {
      skill,
      stem: `A concert venue sells tickets at $p$ dollars each. At that price it sells $${a}-${b}p$ tickets, so its revenue is $R(p)=p(${a}-${b}p)$. What ticket price maximizes revenue?`,
      correct: `\\$${m}`,
      wrong: [
        { text: `\\$${a / b}`, note: 'used the quantity-intercept price', tag: 'concept' },
        { text: `\\$${m + b}`, note: 'moved one step above the best price', tag: 'setup' },
        { text: `\\$${m - 2}`, note: 'moved one step away from the vertex', tag: 'arithmetic' },
      ],
      explanation: `$R(p)=-${b}p^2+${a}p$ peaks at $p=\\frac{${a}}{2(${b})}=${m}$, so the best price is $\\$${m}$.`,
      desmos,
      skill_note: 'The price that maximizes revenue is halfway between 0 and the price where demand hits 0.',
      check: `confirmed the vertex -b/(2a) = ${m} and that R(${m})=${maxR} beats neighboring prices.`,
    };
  }
  return {
    skill,
    stem: `A concert venue sells tickets at $p$ dollars each. At that price it sells $${a}-${b}p$ tickets, so its revenue is $R(p)=p(${a}-${b}p)$. What is the maximum revenue?`,
    correct: `\\$${maxR}`,
    wrong: [
      { text: `\\$${a * m}`, note: 'ignored the demand term when multiplying', tag: 'setup' },
      { text: `\\$${maxR / 2}`, note: 'halved the revenue for the discount', tag: 'arithmetic' },
      { text: `\\$${maxR + b * m}`, note: 'added instead of substituting the vertex', tag: 'algebra' },
    ],
    explanation: `The vertex price is $p=${m}$, and $R(${m})=${m}(${a}-${b}\\cdot${m})=${maxR}$, so maximum revenue is $\\$${maxR}$.`,
    desmos,
    skill_note: 'Substitute the vertex price back into R(p) — the coefficient -b is not the revenue.',
    check: `computed R(${m})=${maxR} and verified it exceeds R at p=${m}±1.`,
  };
}

// 13. Line-parabola systems
function fLineParabola(d, type) {
  const skill = 'Line–parabola systems';
  const variant = type === 'spr' ? pick(['tangent', 'sum', 'count']) : pick(['tangent', 'count', 'sum']);
  const b = nz(5);
  if (variant === 'tangent') {
    const t = pick([1, 2, 3, 4]);
    const m = b - 2 * t;
    const k = nz(9);
    const c = k + t * t;
    const D = (b - m) * (b - m) - 4 * (c - k);
    need(D === 0, 'tangent');
    need(c <= 60, 'size');
    if (type === 'spr') {
      return {
        skill,
        stem: `The line $y=${lineExpr(m, k)}$ is tangent to the parabola $y=${poly(1, b, 0)} + c$ at exactly one point. What is the value of $c$?`,
        correct: String(c),
        wrong: [],
        spr: [String(c)],
        explanation: `Set the expressions equal: $${poly(1, b - m, c - k)}=0$. Tangency requires a zero discriminant, so $(${b - m})^2-4(c${constC(-k)})=0$ and $c=${k}+${t * t}=${c}$.`,
        desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
        skill_note: 'Tangency means the combined quadratic has discriminant zero.',
        check: `substituted c=${c}: discriminant ${D}, and the quadratic is (x${-t >= 0 ? '-' : '+'}${Math.abs(t)})^2.`,
      };
    }
    return {
      skill,
      stem: `The line $y=${lineExpr(m, k)}$ is tangent to the parabola $y=${poly(1, b, 0)} + c$ at exactly one point. What is the value of $c$?`,
      correct: String(c),
      wrong: [
        { text: String(k), note: 'kept the line intercept as c', tag: 'concept' },
        { text: String(k - t * t), note: 'subtracted the squared offset instead of adding', tag: 'sign' },
        { text: String(c + 1), note: 'off by one from an arithmetic slip', tag: 'arithmetic' },
      ],
      explanation: `Equating gives $${poly(1, b - m, c - k)}=0$. Setting the discriminant to zero: $(${b - m})^2=4(c${constC(-k)})$, so $c=${k}+${t * t}=${c}$.`,
      desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
      skill_note: 'Tangency is a discriminant condition, not a visual guess.',
      check: `discriminant of the difference is exactly 0 and the double root is x=${t}.`,
    };
  }
  if (variant === 'count') {
    const x1 = nz(4);
    let x2 = nz(4);
    const want = pick(['two', 'one', 'zero']);
    if (want !== 'two') x2 = want === 'one' ? x1 : null;
    let c = nz(8);
    let m, k;
    if (want === 'two') {
      if (x1 === x2) return null;
      m = x1 + x2 + b;
      k = c - x1 * x2;
    } else if (want === 'one') {
      m = 2 * x1 + b;
      k = c - x1 * x1;
    } else {
      m = nz(4);
      // choose k so that (b-m)^2 - 4(c-k) < 0
      const needK = c - Math.floor(((b - m) * (b - m)) / 4) - ri(1, 4);
      k = needK;
    }
    if (Math.abs(m) > 30 || Math.abs(k) > 60) return null;
    const D = (b - m) * (b - m) - 4 * (c - k);
    const count = D > 0 ? 2 : D === 0 ? 1 : 0;
    need((want === 'two' && count === 2) || (want === 'one' && count === 1) || (want === 'zero' && count === 0), 'count');
    if (type === 'spr') {
      return {
        skill,
        stem: `How many points of intersection do the graphs of $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ have?`,
        correct: String(count),
        wrong: [],
        spr: [String(count)],
        explanation: `Setting the expressions equal gives $${poly(1, b - m, c - k)}=0$, whose discriminant is $${D}$. ${D > 0 ? 'A positive discriminant means two intersection points.' : D === 0 ? 'A zero discriminant means the line is tangent, so one point.' : 'A negative discriminant means the graphs do not meet.'}`,
        desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
        skill_note: 'Intersections of a line and a parabola are the real solutions of the difference quadratic.',
        check: `computed D=${D} and confirmed by solving; ${count} real solution(s).`,
      };
    }
    return {
      skill,
      stem: `How many points of intersection do the graphs of $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ have?`,
      correct: String(count),
      wrong: [
        { text: String(count === 2 ? 1 : 2), note: 'misread the discriminant sign', tag: 'concept' },
        { text: String(count === 0 ? 2 : 0), note: 'reversed the discriminant conclusion', tag: 'concept' },
        { text: 'Infinitely many', note: 'thought the graphs coincide', tag: 'misread' },
      ],
      explanation: `Equating the two expressions gives a quadratic with discriminant $${D}$. ${D > 0 ? 'Positive, so there are two intersection points.' : D === 0 ? 'Zero, so the line is tangent and there is one point.' : 'Negative, so there are no intersection points.'}`,
      desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
      skill_note: 'Subtract the line from the parabola first; the discriminant of that quadratic counts intersections.',
      check: `solved the difference quadratic explicitly and counted ${count} real root(s).`,
    };
  }
  const x1 = nz(5);
  let x2 = nz(5);
  if (x1 === x2) return null;
  const c = nz(7);
  const m = x1 + x2 + b;
  const k = c - x1 * x2;
  need(Math.abs(m) <= 25 && Math.abs(k) <= 45, 'size');
  const y1 = x1 * x1 + b * x1 + c;
  const y2 = x2 * x2 + b * x2 + c;
  need(y1 - m * x1 === k && y2 - m * x2 === k, 'line');
  if (type === 'spr') {
    return {
      skill,
      stem: `The system $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ has two solutions. What is the sum of the $x$-coordinates of the solutions?`,
      correct: String(x1 + x2),
      wrong: [],
      spr: [String(x1 + x2)],
      explanation: `Substituting gives $${poly(1, b - m, c - k)}=0$. By Vieta, the sum of the $x$-coordinates is $-\\frac{b}{a}=${x1 + x2}$.`,
      desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
      skill_note: 'You do not need the individual intersections to get their sum — Vieta does it directly.',
      check: `solved the system: x=${x1} (y=${y1}) and x=${x2} (y=${y2}); the sum is ${x1 + x2}.`,
    };
  }
  return {
    skill,
    stem: `The system $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ has two solutions. What is one of the solutions?`,
    correct: `$(${x1},${y1})$`,
    wrong: [
      { text: `$(${x1},${y2})$`, note: 'paired an x-coordinate with the other y-coordinate', tag: 'setup' },
      { text: `$(${x2},${y1})$`, note: 'swapped the y-coordinates', tag: 'setup' },
      { text: `$(${x1 + 1},${y1 + 1})$`, note: 'shifted both coordinates by one', tag: 'arithmetic' },
    ],
    explanation: `Substituting gives $${poly(1, b - m, c - k)}=0$, which factors with roots $x=${x1}$ and $x=${x2}$. At $x=${x1}$, the line gives $y=${y1}$, so $(${x1},${y1})$ is a solution.`,
    desmos: `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`,
    skill_note: 'A solution of a system must satisfy both equations; substitute to check the pair.',
    check: `verified (${x1},${y1}) satisfies both equations; the other intersection is (${x2},${y2}).`,
  };
}

// 14. Nonlinear systems
function fNonlinearSystem(d, type) {
  const x1 = nz([4, 5, 6, 7, 8][d]);
  let x2 = nz([4, 5, 6, 7, 8][d]);
  if (x1 === x2) return null;
  const b = nz(4);
  const c = nz(6);
  const m = x1 + x2 + b;
  const k = c - x1 * x2;
  if (Math.abs(m) > 22 || Math.abs(k) > 40) return null;
  const y1 = x1 * x1 + b * x1 + c;
  const y2 = x2 * x2 + b * x2 + c;
  need(y1 === m * x1 + k && y2 === m * x2 + k, 'system');
  need(y1 === (x1 - x1) + y1, 'noop');
  const skill = 'Nonlinear systems';
  const desmos = `y=${poly(1, b, c)}; y=${lineExpr(m, k)}`;
  if (type === 'spr') {
    const askY = chance(0.5);
    if (askY) {
      return {
        skill,
        stem: `The system $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ has two solutions. What is the greater $y$-coordinate of the two solutions?`,
        correct: String(Math.max(y1, y2)),
        wrong: [],
        spr: [String(Math.max(y1, y2))],
        explanation: `Solving gives $x=${x1}$ and $x=${x2}$; the corresponding $y$-values are $${y1}$ and $${y2}$. The greater is $${Math.max(y1, y2)}$.`,
        desmos,
        skill_note: 'Solve for x first, then substitute into either equation for y.',
        check: `substituted x=${x1} and x=${x2} into both equations; y-values ${y1} and ${y2} agree.`,
      };
    }
    return {
      skill,
      stem: `The system $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$ has two solutions. What is the product of the $x$-coordinates of the solutions?`,
      correct: String(x1 * x2),
      wrong: [],
      spr: [String(x1 * x2)],
      explanation: `The difference quadratic is $${poly(1, b - m, c - k)}=0$, whose roots are $${x1}$ and $${x2}$. Their product is $${x1 * x2}$.`,
      desmos,
      skill_note: 'The product of the x-coordinates is c/a of the difference quadratic.',
      check: `factored the difference quadratic with roots ${x1} and ${x2}; product ${x1 * x2}.`,
    };
  }
  return {
    skill,
    stem: `What is the solution set of the system $y=${poly(1, b, c)}$ and $y=${lineExpr(m, k)}$?`,
    correct: `$(${Math.min(x1, x2)},${Math.min(x1, x2) === x1 ? y1 : y2})$ and $(${Math.max(x1, x2)},${Math.max(x1, x2) === x1 ? y1 : y2})$`,
    wrong: [
      { text: `$(${x1},${y2})$ and $(${x2},${y1})$`, note: 'crossed the y-coordinates', tag: 'setup' },
      { text: `$(${x1},${-y1})$ and $(${x2},${-y2})$`, note: 'negated the y-coordinates', tag: 'sign' },
      { text: `$(${x1 + x2},${y1 + y2})$`, note: 'combined the solutions into one point', tag: 'concept' },
    ],
    explanation: `Equating gives $${poly(1, b - m, c - k)}=0$, so $x=${x1}$ or $x=${x2}$. Substituting back gives $y=${y1}$ and $y=${y2}$.`,
    desmos,
    skill_note: 'Each x-value paired with its own y-value; never mix them across solutions.',
    check: `substituted both ordered pairs into both original equations.`,
  };
}

// 15. Polynomial remainder theorem
function fRemainder(d, type) {
  const k = nz([3, 4, 5, 6, 7][d]);
  const a = nz(4);
  const b = nz(5);
  const base = k * k * k + a * k * k + b * k;
  // synthetic division of x^3 + a x^2 + b x + c by (x - k)
  const syn = (cc) => {
    // synthetic division: coefficients 1, a, b, cc divided by (x - k)
    let acc = 1;
    acc = a + k * acc;
    acc = b + k * acc;
    return cc + k * acc;
  };
  need(syn(0) === base, 'synthetic base');
  if (type === 'spr') {
    const c = nz([8, 10, 12, 15, 20][d]);
    const R = base + c;
    if (Math.abs(R) > 250) return null;
    need(syn(c) === R, 'synthetic remainder');
    const skill = 'Polynomial remainder theorem';
    return {
      skill,
      stem: `The polynomial $p(x)=${cubic(a, b, 'c')}$ has remainder $${R}$ when divided by $x${k >= 0 ? '-' : '+'}${Math.abs(k)}$. What is the value of $c$?`,
      correct: String(c),
      wrong: [],
      spr: [String(c)],
      explanation: `By the remainder theorem, $p(${k})=${R}$. So $${k}^3${a >= 0 ? '+' : '-'}${Math.abs(a)}(${k})^2${b >= 0 ? '+' : '-'}${Math.abs(b)}(${k})+c=${R}$, which gives $${base}+c=${R}$ and $c=${c}$.`,
      desmos: `y=${cubic(a, b, c)}`,
      skill_note: 'The remainder of p(x) divided by (x-k) is p(k), the value at the divisor root.',
      check: `evaluated p(${k})=${R} directly after solving for c.`,
    };
  }
  const c = nz(9);
  const R = base + c;
  if (Math.abs(R) > 200) return null;
  const wrongR = -(k * k * k) + a * k * k - b * k + c;
  need(syn(c) === R, 'synthetic remainder');
  need(wrongR !== R, 'distinct remainder');
  const skill = 'Polynomial remainder theorem';
  return {
    skill,
    stem: `The polynomial $p(x)=${cubic(a, b, c)}$ is divided by $x${k >= 0 ? '-' : '+'}${Math.abs(k)}$. What is the remainder?`,
    correct: String(R),
    wrong: [
      { text: String(wrongR), note: 'evaluated at the opposite of the divisor root', tag: 'sign' },
      { text: String(c), note: 'used the constant term as the remainder', tag: 'concept' },
      { text: String(base), note: 'forgot to include the constant term', tag: 'algebra' },
    ],
    explanation: `The remainder theorem says the remainder is $p(${k})=${k}^3${a >= 0 ? '+' : '-'}${Math.abs(a)}(${k})^2${b >= 0 ? '+' : '-'}${Math.abs(b)}(${k})${c >= 0 ? '+' : '-'}${Math.abs(c)}=${R}$.`,
    desmos: `y=${cubic(a, b, c)}`,
    skill_note: 'Dividing by x-k means evaluate at x=+k, not -k.',
    check: `computed p(${k})=${R} and p(${-k})=${wrongR} to confirm the sign trap distinguishes the choices.`,
  };
}

// 16. Factor theorem
function fFactorTheorem(d, type) {
  const roots = shuffle([-1, 1, -2, 2, -3, 3, -4, 4]).slice(0, 3);
  const a = -(roots[0] + roots[1] + roots[2]);
  const b = roots[0] * roots[1] + roots[0] * roots[2] + roots[1] * roots[2];
  const c = -roots[0] * roots[1] * roots[2];
  need(a === -(roots[0] + roots[1] + roots[2]), 'vieta3');
  const evalP = (x, cc) => x * x * x + a * x * x + b * x + cc;
  need(evalP(roots[0], c) === 0 && evalP(roots[1], c) === 0 && evalP(roots[2], c) === 0, 'roots3');
  const skill = 'Factor theorem';
  const desmos = `y=${cubic(a, b, c)}`;
  if (type === 'spr') {
    const k = pick([-3, -2, 2, 3, 4]);
    const cc = -(k * k * k + a * k * k + b * k);
    if (Math.abs(cc) > 150) return null;
    return {
      skill,
      stem: `The polynomial $p(x)=${cubic(a, b, 'c')}$ has $x${k >= 0 ? '-' : '+'}${Math.abs(k)}$ as a factor. What is the value of $c$?`,
      correct: String(cc),
      wrong: [],
      spr: [String(cc)],
      explanation: `By the factor theorem, $p(${k})=0$. So $${k}^3${a >= 0 ? '+' : '-'}${Math.abs(a)}(${k})^2${b >= 0 ? '+' : '-'}${Math.abs(b)}(${k})+c=0$, giving $c=${cc}$.`,
      desmos: `y=${cubic(a, b, cc)}`,
      skill_note: 'A factor (x-k) means p(k)=0; solve for the unknown coefficient from that equation.',
      check: `re-evaluated p(${k})=0 with c=${cc}.`,
    };
  }
  const shown = shuffle(roots);
  const correct = `$x${shown[0] >= 0 ? '-' : '+'}${Math.abs(shown[0])}$`;
  // distractor constants must NOT be roots (x - m is a factor exactly when m is a zero)
  const nonRoots = [];
  for (let v = -6; v <= 6; v++) if (v !== 0 && !roots.includes(v)) nonRoots.push(v);
  const decoys = shuffle(nonRoots).slice(0, 3);
  const wrongs = decoys.map((v) => `$x${v >= 0 ? '-' : '+'}${Math.abs(v)}$`);
  return {
    skill,
    stem: `The polynomial $p(x)=${cubic(a, b, c)}$ has three integer zeros. Which of the following is a factor of $p(x)$?`,
    correct,
    wrong: [
      { text: wrongs[0], note: 'chose a value that is not a zero of p', tag: 'concept' },
      { text: wrongs[1], note: 'confused a coefficient with a zero', tag: 'concept' },
      { text: wrongs[2], note: 'guessed an integer that does not make p zero', tag: 'arithmetic' },
    ],
    explanation: `Testing integer values, $p(${shown[0]})=0$, so $x${shown[0] >= 0 ? '-' : '+'}${Math.abs(shown[0])}$ is a factor. The full factorization is ${fac(roots[0])}${fac(roots[1])}${fac(roots[2])}.`,
    desmos,
    skill_note: 'A factor is (x - zero); the sign inside the binomial is the opposite of the zero.',
    check: `evaluated p at ${roots.join(', ')}; all three are 0, and expansion reproduces a=${a}, b=${b}, c=${c}.`,
  };
}

// 17. Rational expression simplification
function fRationalSimplify(d, type) {
  const lim = [4, 5, 6, 7, 8][d];
  const a = nz(lim);
  let bb = nz(lim);
  if (a === bb || a === -bb) return null;
  const B = -(a + bb);
  const C = a * bb;
  const N = -a * a;
  need((a - a) * (a + a) === 0 && a * a + B * a + C === 0, 'denRoot');
  need(bb * bb + B * bb + C === 0, 'denRoot2');
  const orig = (x) => (x * x + N) / (x * x + B * x + C);
  const simp = (x) => (x + a) / (x - bb);
  need(Math.abs(orig(0) - simp(0)) < 1e-9 && Math.abs(orig(1) - simp(1)) < 1e-9, 'equiv rational');
  const skill = 'Rational expression simplification';
  const desmos = `y=(${poly(1, 0, N)})/(${poly(1, B, C)})`;
  if (type === 'spr') {
    const sum = a + bb;
    return {
      skill,
      stem: `The expression $\\frac{${poly(1, 0, N)}}{${poly(1, B, C)}}$ is not defined at two values of $x$. What is the sum of those two values?`,
      correct: String(sum),
      wrong: [],
      spr: [String(sum)],
      explanation: `The denominator factors as ${fac(a)}${fac(bb)}, so it is zero at $x=${a}$ and $x=${bb}$. Their sum is $${sum}$. (The numerator also vanishes at $x=${a}$, but the expression is still not defined there.)`,
      desmos,
      skill_note: 'Canceling a common factor removes the value from the simplified expression but not from the domain.',
      check: `evaluated the denominator at x=${a} and x=${bb} (both 0); sum ${sum}.`,
    };
  }
  return {
    skill,
    stem: `Which expression is equivalent to $\\frac{${poly(1, 0, N)}}{${poly(1, B, C)}}$ for all values of $x$ where the expression is defined?`,
    correct: `$\\frac{x${a >= 0 ? '+' : '-'}${Math.abs(a)}}{x${bb >= 0 ? '-' : '+'}${Math.abs(bb)}}$`,
    wrong: [
      { text: `$\\frac{x${-a >= 0 ? '+' : '-'}${Math.abs(a)}}{x${bb >= 0 ? '-' : '+'}${Math.abs(bb)}}$`, note: 'flipped the sign in the numerator', tag: 'sign' },
      { text: `$\\frac{x${a >= 0 ? '+' : '-'}${Math.abs(a)}}{x${-bb >= 0 ? '+' : '-'}${Math.abs(bb)}}$`, note: 'flipped the sign in the denominator', tag: 'sign' },
      { text: `$\\frac{x${-a >= 0 ? '+' : '-'}${Math.abs(a)}}{x${-bb >= 0 ? '+' : '-'}${Math.abs(bb)}}$`, note: 'flipped both signs', tag: 'sign' },
    ],
    explanation: `Factor: $${poly(1, 0, N)}=${fac(a)}${fac(-a)}$ and $${poly(1, B, C)}=${fac(a)}${fac(bb)}$. Canceling ${fac(a)} leaves $\\frac{x${-a >= 0 ? '+' : '-'}${Math.abs(a)}}{x${bb >= 0 ? '-' : '+'}${Math.abs(bb)}}$, with $x\\neq${a},${bb}$.`,
    desmos,
    skill_note: 'Factor both parts before canceling; the canceled factor still restricts the domain.',
    check: `expanded both factorizations back to coefficients and tested x=0: original ${fr(-a, -bb)}, simplified ${fr(-a, -bb)}.`,
  };
}

// 18. Rational equations
function fRationalEquation(d, type) {
  const skill = 'Rational equations';
  if (type === 'spr' || chance(0.45)) {
    const a = ri(3, 9);
    let bb = ri(1, 12);
    if (bb === a) return null;
    const x = 2 * a - bb;
    if (x === a) return null;
    need(x - bb === 2 * (x - a), 'rational solve');
    if (type === 'spr') {
      return {
        skill,
        stem: `What is the solution to the equation $\\frac{x}{x-${a}}=\\frac{${bb}}{x-${a}}+2$?`,
        correct: String(x),
        wrong: [],
        spr: [String(x)],
        explanation: `Multiply both sides by $x-${a}$: $x=${bb}+2(x-${a})$, so $x=${bb}+2x-${2 * a}$ and $x=${x}$. Since $x=${x}\\neq${a}$, the solution is valid.`,
        desmos: `y=x/(x-${a})`,
        skill_note: 'Clear the denominator, then check the result against the excluded value.',
        check: `substituted x=${x}: left side ${fr(x, x - a)}, right side ${fr(bb, x - a)} + 2 = ${fr(bb + 2 * (x - a), x - a)}.`,
      };
    }
    return {
      skill,
      stem: `What is the solution to the equation $\\frac{x}{x-${a}}=\\frac{${bb}}{x-${a}}+2$?`,
      correct: `$x=${x}$`,
      wrong: [
        { text: `$x=${a}$`, note: 'kept the excluded denominator value', tag: 'concept' },
        { text: `$x=${bb}$`, note: 'dropped the 2 after clearing denominators', tag: 'algebra' },
        { text: `$x=${x + 2}$`, note: 'sign slip when distributing the 2', tag: 'sign' },
      ],
      explanation: `Multiplying by $x-${a}$ gives $x=${bb}+2x-${2 * a}$, so $x=${x}$. This value does not make the denominator zero, so it is the solution.`,
      desmos: `y=x/(x-${a})`,
      skill_note: 'After clearing denominators, always test the candidate against x = a.',
      check: `verified both sides equal at x=${x} and that x=${a} is excluded.`,
    };
  }
  const p = ri(2, 9);
  const c = pick([2, 3, -2, 4]);
  need(c !== -1, 'c');
  const checkX = p;
  need(checkX * (1 + c) === p * (1 + c), 'identity');
  return {
    skill,
    stem: `What is the solution to the equation $\\frac{x}{x-${p}}${constC(c)}=\\frac{${p}}{x-${p}}$?`,
    correct: 'No solution',
    wrong: [
      { text: `$x=${p}$`, note: 'accepted the extraneous value that zeroes the denominator', tag: 'concept' },
      { text: `$x=${-p}$`, note: 'flipped the sign while clearing denominators', tag: 'sign' },
      { text: `$x=${p + 1}$`, note: 'made an arithmetic slip after cross-multiplying', tag: 'arithmetic' },
    ],
    explanation: `Multiplying by $x-${p}$ gives $x${constC(c)}(x-${p})=${p}$, so $(1${constC(c)})x=${p}(1${constC(c)})$ and $x=${p}$. But $x=${p}$ makes the denominator zero, so it is extraneous and the equation has no solution.`,
    desmos: `y=x/(x-${p})${constC(c)}`,
    skill_note: 'A rational equation can collapse to the excluded value, which means no solution — not x equals that value.',
    check: `solved the cleared equation (x=${p}) and confirmed the original is not defined there; no other candidate exists.`,
  };
}

// 19. Radical equations
function fRadical(d, type) {
  const v = ri(4, 9);
  const e = v - 1 - 2 * ri(1, 3);
  const b = (v + e - 1) / 2;
  need(Number.isInteger(b), 'b');
  const a = b * b - v * e;
  if (b === 0 || a === 0 || Math.abs(a) > 40) return null;
  need(a === (v - b) * (v - b) - v, 'a identity');
  need(v + a >= 0 && (v - b) * (v - b) === v + a, 'radicand');
  need(e + a === (e - b) * (e - b) && e - b < 0, 'extraneous');
  const skill = 'Radical equations';
  const desmos = `y=sqrt(x${a >= 0 ? '+' : '-'}${Math.abs(a)}); y=x${b >= 0 ? '-' : '+'}${Math.abs(b)}`;
  if (type === 'spr') {
    return {
      skill,
      stem: `What is the solution to the equation $\\sqrt{${lin1(a)}}=${lineExpr(1, -b)}$?`,
      correct: String(v),
      wrong: [],
      spr: [String(v)],
      explanation: `Squaring gives $${lin1(a)}=${poly(1, -2 * b, b * b)}$, which factors with $x=${v}$ and $x=${e}$. The value $x=${e}$ fails the original equation because the right side is negative, so the only solution is $x=${v}$.`,
      desmos,
      skill_note: 'Squaring can create extraneous roots; substitute every candidate into the original radical equation.',
      check: `substituted x=${v} (both sides ${v - b}) and x=${e} (left ${b - e}, right ${e - b}) into the original.`,
    };
  }
  return {
    skill,
    stem: `What is the solution to the equation $\\sqrt{${lin1(a)}}=${lineExpr(1, -b)}$?`,
    correct: `$x=${v}$`,
    wrong: [
      { text: `$x=${e}$`, note: 'kept the extraneous root from squaring', tag: 'concept' },
      { text: `$x=${v}$ and $x=${e}$`, note: 'reported both roots without checking', tag: 'concept' },
      { text: 'No solution', note: 'discarded the valid root as well', tag: 'misread' },
    ],
    explanation: `Squaring produces $${poly(1, -2 * b - 1, b * b - a)}=0$, with roots $x=${v}$ and $x=${e}$. Testing shows $x=${e}$ makes the right side negative, so only $x=${v}$ solves the original equation.`,
    desmos,
    skill_note: 'The square root is nonnegative, so any candidate making the other side negative is extraneous.',
    check: `checked both candidates in the original equation: x=${v} works, x=${e} does not.`,
  };
}

// 20. Exponential growth models
function fGrowth(d, type) {
  const P0 = pick([200, 400, 500, 800, 1000, 2000, 2500, 4000]);
  const r = pick([5, 10, 20, 25, 50]);
  const t = pick([2, 3]);
  const b = 1 + r / 100;
  const value = P0 * Math.pow(b, t);
  if (!Number.isInteger(value)) return null;
  need(Number.isInteger(value), 'int');
  const skill = 'Exponential growth models';
  const desmos = `y=${P0}(${b})^x`;
  const variant = pick(['value', 'percent', 'model']);
  if (type === 'spr' && variant !== 'model') {
    if (variant === 'percent') {
      return {
        skill,
        stem: `The function $P(t)=${P0}(${b})^t$ models a population $t$ years after it was first measured. By what percent does the population increase each year?`,
        correct: String(r),
        wrong: [],
        spr: [String(r)],
        explanation: `The base is $${b}=1+\\frac{${r}}{100}$, so the growth rate is $${r}\\%$ per year. The initial population is $${P0}$.`,
        desmos,
        skill_note: 'In a(b)^t the base b is 1 plus the growth rate written as a decimal.',
        check: `converted ${b} back to a percent: (${b}-1)*100=${r}.`,
      };
    }
    return {
      skill,
      stem: `A population is modeled by $P(t)=${P0}(${b})^t$, where $t$ is the number of years since 2010. What is the predicted population when $t=${t}$?`,
      correct: String(value),
      wrong: [],
      spr: [String(value)],
      explanation: `$P(${t})=${P0}(${b})^{${t}}=${P0}\\cdot${Number(Math.pow(b, t).toFixed(4))}=${value}$. The exponent applies only to the base, not to the initial value.`,
      desmos,
      skill_note: 'Apply the exponent to the base only, then multiply by the initial value.',
      check: `computed ${P0}*${b}^${t} step by step: ${b}^${t}=${Number(Math.pow(b, t).toFixed(6))}, times ${P0} = ${value}.`,
    };
  }
  if (variant === 'model') {
    return {
      skill,
      stem: `A population of ${P0} organisms increases by ${r}\\% each year. Which function models the population $P$ after $t$ years?`,
      correct: `$P(t)=${P0}(${b})^t$`,
      wrong: [
        { text: `$P(t)=${P0}(1+${r})^t$`, note: 'used the percent as a whole number', tag: 'unit' },
        { text: `$P(t)=${P0}(1-${fr(r, 100)})^t$`, note: 'used a decay base for a growth model', tag: 'concept' },
        { text: `$P(t)=${P0}+${fr(r, 100)}t$`, note: 'modeled linear instead of exponential growth', tag: 'concept' },
      ],
      explanation: `Each year multiplies the population by $1+\\frac{${r}}{100}=${b}$, so $P(t)=${P0}(${b})^t$.`,
      desmos,
      skill_note: 'Repeated percent change is multiplicative; the base is 1 + r/100.',
      check: `checked t=1 gives ${P0 * b} and t=2 gives ${P0 * b * b}, matching repeated multiplication.`,
    };
  }
  return {
    skill,
    stem: `A population is modeled by $P(t)=${P0}(${b})^t$, where $t$ is the number of years since 2010. What is the predicted population when $t=${t}$?`,
    correct: String(value),
    wrong: [
      { text: String(P0 * r * t), note: 'applied linear growth instead of repeated multiplication', tag: 'concept' },
      { text: String(P0 * b * t), note: 'multiplied by the base instead of raising it to t', tag: 'algebra' },
      { text: String(Math.round(value / b)), note: 'used one fewer year of growth', tag: 'misread' },
    ],
    explanation: `Substitute $t=${t}$: $P(${t})=${P0}(${b})^${t}=${value}$. The base ${b} is applied ${t} times, so the growth compounds.`,
    desmos,
    skill_note: 'Exponential growth compounds, so the exponent counts the number of years, not a multiplier.',
    check: `computed ${b}^${t}=${Number(Math.pow(b, t).toFixed(6))} and multiplied by ${P0}.`,
  };
}

// 21. Exponential decay models
function fDecay(d, type) {
  const V0 = pick([12000, 16000, 20000, 24000, 25000, 32000, 40000, 50000]);
  const r = pick([10, 20, 25, 50]);
  const t = pick([2, 3]);
  const b = 1 - r / 100;
  const value = V0 * Math.pow(b, t);
  if (!Number.isInteger(value)) return null;
  const skill = 'Exponential decay models';
  const desmos = `y=${V0}(${b})^x`;
  const variant = pick(['value', 'percent', 'model']);
  if (type === 'spr' && variant === 'percent') {
    return {
      skill,
      stem: `The value of a car is modeled by $V(t)=${V0}(${b})^t$, where $t$ is the number of years since purchase. By what percent does the value decrease each year?`,
      correct: String(r),
      wrong: [],
      spr: [String(r)],
      explanation: `The base is $${b}=1-\\frac{${r}}{100}$, so the value loses $${r}\\%$ of its value each year.`,
      desmos,
      skill_note: 'A base below 1 means decay; the percent lost is 1 - b written as a percent.',
      check: `the base ${b} means ${b * 100}% of the value remains each year, so the loss is ${r}%.`,
    };
  }
  if (type === 'spr') {
    return {
      skill,
      stem: `A car purchased for $\\$${V0}$ loses ${r}\\%$ of its value each year. The value after $t$ years is $V(t)=${V0}(${b})^t$. What is the value of the car after ${t} years, in dollars?`,
      correct: String(value),
      wrong: [],
      spr: [String(value)],
      explanation: `$V(${t})=${V0}(${b})^{${t}}=${V0}\\cdot${Number(Math.pow(b, t).toFixed(4))}=${value}$, so the car is worth $\\$${value}$.`,
      desmos,
      skill_note: 'Decay multiplies by the same factor each year; do not subtract a fixed dollar amount.',
      check: `computed ${V0}*${b}^${t}=${value}.`,
    };
  }
  if (variant === 'model') {
    return {
      skill,
      stem: `A car purchased for $\\$${V0}$ loses ${r}\\%$ of its value each year. Which function models the value $V$ after $t$ years?`,
      correct: `$V(t)=${V0}(${b})^t$`,
      wrong: [
        { text: `$V(t)=${V0}(1-${r})^t$`, note: 'used the percent as a whole number', tag: 'unit' },
        { text: `$V(t)=${V0}(1+${fr(r, 100)})^t$`, note: 'used a growth base for a decaying value', tag: 'concept' },
        { text: `$V(t)=${V0}-${fr(r, 100)}t$`, note: 'modeled linear depreciation', tag: 'concept' },
      ],
      explanation: `Each year the car keeps $1-\\frac{${r}}{100}=${b}$ of its value, so $V(t)=${V0}(${b})^t$.`,
      desmos,
      skill_note: 'Percent decay multiplies by 1 - r/100, not by r/100.',
      check: `checked t=1 (${V0 * b}) and t=2 (${V0 * b * b}) by repeated multiplication.`,
    };
  }
  return {
    skill,
    stem: `A car purchased for $\\$${V0}$ loses ${r}\\%$ of its value each year, so $V(t)=${V0}(${b})^t$. What is the value of the car after ${t} years?`,
    correct: `\\$${value}`,
    wrong: [
      { text: `\\$${V0 - V0 * (r / 100) * t}`, note: 'subtracted the same dollar amount each year', tag: 'concept' },
      { text: `\\$${Math.round(V0 * Math.pow(b, t - 1))}`, note: 'used one fewer year of decay', tag: 'misread' },
      { text: `\\$${Math.round(V0 * b)}`, note: 'applied only one year of decay', tag: 'setup' },
    ],
    explanation: `$V(${t})=${V0}(${b})^${t}=${value}$, so the car is worth $\\$${value}$ after ${t} years.`,
    desmos,
    skill_note: 'Compounding decay is repeated multiplication, not repeated subtraction.',
    check: `computed ${b}^${t}=${Number(Math.pow(b, t).toFixed(6))} and multiplied by ${V0}.`,
  };
}

// 22. Exponential model parameters
function fModelParam(d, type) {
  const b = pick([2, 3, 4, 5]);
  const k = pick([2, 3]);
  const N0 = pick([40, 50, 100, 150, 200, 300, 400]);
  const Nk = N0 * Math.pow(b, k);
  need(N0 * Math.pow(b, k) === Nk, 'param');
  const skill = 'Exponential model parameters';
  const desmos = `y=${N0}(${b})^x`;
  if (type === 'spr') {
    const askB = chance(0.65);
    if (askB) {
      return {
        skill,
        stem: `The number of bacteria in a culture is modeled by $N(t)=N_0 b^t$, where $t$ is in hours. There are ${N0} bacteria at $t=0$ and ${Nk} bacteria at $t=${k}$. What is the value of $b$?`,
        correct: String(b),
        wrong: [],
        spr: [String(b)],
        explanation: `Divide: $\\frac{N(${k})}{N(0)}=\\frac{${Nk}}{${N0}}=${Math.pow(b, k)}=b^{${k}}$, so $b=${b}$. The base of an exponential model must be positive, so only the positive root is kept.`,
        desmos,
        skill_note: 'The ratio of two outputs equals b raised to the time difference.',
        check: `substituted b=${b}: ${N0}*${b}^${k}=${Nk}.`,
      };
    }
    const Nk3 = N0 * Math.pow(3, k);
    return {
      skill,
      stem: `The number of bacteria is modeled by $N(t)=N_0 b^t$. The culture starts with $N_0$ bacteria and triples every hour, reaching ${Nk3} bacteria after ${k} hours. What is $N_0$?`,
      correct: String(N0),
      wrong: [],
      spr: [String(N0)],
      explanation: `$N_0\\cdot 3^{${k}}=${Nk3}$, so $N_0=\\frac{${Nk3}}{${Math.pow(3, k)}}=${N0}$. Dividing by the growth factor raised to the elapsed time undoes the growth.`,
      desmos: `y=${N0}(3)^x`,
      skill_note: 'Work backward by dividing by the growth factor raised to the elapsed time.',
      check: `${N0}*3^${k}=${Nk3}; matches the stated final count only for N0=${N0}.`,
    };
  }
  const variants = [
    {
      stem: `The number of bacteria in a culture is modeled by $N(t)=N_0 b^t$, where $t$ is in hours. There are ${N0} bacteria at $t=0$ and ${Nk} bacteria at $t=${k}$. What is the value of $b$?`,
      correct: String(b),
      wrong: [
        { text: String(Nk / N0), note: 'used the total ratio without taking the root', tag: 'algebra' },
        { text: String(b * k), note: 'divided by the time instead of taking the kth root', tag: 'concept' },
        { text: String(b + 1), note: 'added one to the growth factor', tag: 'arithmetic' },
      ],
      explanation: `$b^{${k}}=\\frac{${Nk}}{${N0}}=${Math.pow(b, k)}$, so $b=${b}$. The base of an exponential model is positive, so the negative root is rejected.`,
    },
    {
      stem: `The number of bacteria in a culture doubles every hour. The model is $N(t)=N_0 b^t$. What is the value of $b$?`,
      correct: String(2),
      wrong: [
        { text: String(1), note: 'used no growth', tag: 'concept' },
        { text: String(N0), note: 'confused the growth factor with the initial value', tag: 'misread' },
        { text: '0.5', note: 'used a decay factor for doubling', tag: 'concept' },
      ],
      explanation: `Doubling each hour means each output is 2 times the previous one, so $b=2$.`,
    },
  ];
  const v = pick(variants);
  return {
    skill,
    stem: v.stem,
    correct: v.correct,
    wrong: v.wrong,
    explanation: v.explanation,
    desmos,
    skill_note: 'The base b is the factor per unit time; the initial value is the coefficient.',
    check: `verified N(0)=${N0} and N(${k})=${Nk} with b=${b}.`,
  };
}

// 23. Exponential functions from two points
function fExpFit(d, type) {
  const b = pick([2, 3, 4, 5]);
  const a = pick([2, 3, 4, 5, 6, 10]);
  const n = pick([2, 3]);
  const y = a * Math.pow(b, n);
  if (y > 40000) return null;
  need(a * Math.pow(b, n) === y, 'fit');
  const skill = 'Exponential functions from two points';
  const desmos = `y=${a}(${b})^x`;
  if (type === 'spr') {
    return {
      skill,
      stem: `An exponential function $f(t)=a b^t$ passes through the points $(0,${a})$ and $(${n},${y})$. What is the value of $b$?`,
      correct: String(b),
      wrong: [],
      spr: [String(b)],
      explanation: `From $(0,${a})$ we get $a=${a}$. Then $${a}b^{${n}}=${y}$, so $b^{${n}}=${y / a}$ and $b=${b}$.`,
      desmos,
      skill_note: 'The y-intercept gives a; the second point gives b after dividing and taking the nth root.',
      check: `substituted both points: f(0)=${a} and ${a}*${b}^${n}=${y}.`,
    };
  }
  return {
    skill,
    stem: `An exponential function $f(t)=a b^t$ passes through the points $(0,${a})$ and $(${n},${y})$. Which equation defines $f$?`,
    correct: `$f(t)=${a}(${b})^t$`,
    wrong: [
      { text: `$f(t)=${a}(${y / a})^t$`, note: 'used the ratio without taking the root', tag: 'algebra' },
      { text: `$f(t)=${y}(${b})^t$`, note: 'used the second output as the initial value', tag: 'setup' },
      { text: `$f(t)=${a}(${b * n})^t$`, note: 'multiplied the base by the time', tag: 'concept' },
    ],
    explanation: `The point $(0,${a})$ gives $a=${a}$. Substituting the second point: $${a}b^{${n}}=${y}$, so $b^{${n}}=${y / a}$ and $b=${b}$. Thus $f(t)=${a}(${b})^t$.`,
    desmos,
    skill_note: 'Two points determine a and b; do not confuse the growth factor with the total ratio.',
    check: `verified f(0)=${a} and f(${n})=${y} from the equation.`,
  };
}

// 24. Half-life and doubling
function fHalfLife(d, type) {
  const skill = 'Half-life and doubling';
  if (chance(0.5)) {
    const A0 = pick([80, 160, 240, 320, 400, 640, 800]);
    const H = pick([3, 4, 5, 6, 8, 10]);
    const n = pick([1, 2, 3]);
    const t = H * n;
    const remaining = A0 / Math.pow(2, n);
    if (!Number.isInteger(remaining)) return null;
    need(A0 * Math.pow(0.5, n) === remaining, 'half');
    if (type === 'spr') {
      return {
        skill,
        stem: `A radioactive sample has a half-life of ${H} years. If the sample starts with ${A0} grams, how many grams remain after ${t} years?`,
        correct: String(remaining),
        wrong: [],
        spr: [String(remaining)],
        explanation: `$${t}$ years is $\\frac{${t}}{${H}}=${n}$ half-lives, so the mass is $${A0}\\left(\\frac{1}{2}\\right)^{${n}}=${remaining}$ grams.`,
        desmos: `y=${A0}(0.5)^(x/${H})`,
        skill_note: 'Count half-lives first, then halve that many times.',
        check: `${A0}/2^${n}=${remaining} and ${t}/${H}=${n}.`,
      };
    }
    return {
      skill,
      stem: `A radioactive sample has a half-life of ${H} years and starts with ${A0} grams. What fraction of the original mass remains after ${t} years?`,
      correct: `$\\frac{1}{${Math.pow(2, n)}}$`,
      wrong: [
        { text: `$\\frac{1}{${n}}$`, note: 'used the number of half-lives as the denominator', tag: 'concept' },
        { text: `$\\frac{1}{${t}}$`, note: 'used the elapsed years as the denominator', tag: 'setup' },
        { text: `$\\frac{1}{${2 * n}}$`, note: 'halved once per year instead of per half-life', tag: 'algebra' },
      ],
      explanation: `$${t}$ years is ${n} half-lives, and each half-life leaves half the mass, so the fraction remaining is $\\left(\\frac{1}{2}\\right)^{${n}}=\\frac{1}{${Math.pow(2, n)}}$.`,
      desmos: `y=${A0}(0.5)^(x/${H})`,
      skill_note: 'The fraction remaining depends on the number of half-lives, not on the starting mass.',
      check: `remaining mass ${remaining} divided by ${A0} equals 1/${Math.pow(2, n)}.`,
    };
  }
  const H = pick([4, 5, 6, 8, 10, 12]);
  const n = pick([2, 3]);
  const total = H * n;
  if (type === 'spr') {
    return {
      skill,
      stem: `After ${total} years, a radioactive sample has decayed to $\\frac{1}{${Math.pow(2, n)}}$ of its original mass. What is the half-life of the sample, in years?`,
      correct: String(H),
      wrong: [],
      spr: [String(H)],
      explanation: `A remaining fraction of $\\frac{1}{${Math.pow(2, n)}}$ means ${n} half-lives have passed. Since $${n}H=${total}$, the half-life is $H=${H}$ years.`,
      desmos: `y=(0.5)^(x/${H})`,
      skill_note: 'Match the fraction to a power of 1/2 to count half-lives, then divide the elapsed time.',
      check: `divided ${total} years by ${n} half-lives to get ${H}; also (1/2)^${n}=1/${Math.pow(2, n)}.`,
    };
  }
  return {
    skill,
    stem: `After ${total} years, a radioactive sample has decayed to $\\frac{1}{${Math.pow(2, n)}}$ of its original mass. What is the half-life of the sample?`,
    correct: `$${H}$ years`,
    wrong: [
      { text: `$${total}$ years`, note: 'used the total elapsed time', tag: 'misread' },
      { text: `$${n}$ years`, note: 'reported the number of half-lives', tag: 'concept' },
      { text: `$${total / 2}$ years`, note: 'halved the elapsed time without counting half-lives', tag: 'algebra' },
    ],
    explanation: `$\\frac{1}{${Math.pow(2, n)}}=\\left(\\frac{1}{2}\\right)^{${n}}$, so ${n} half-lives fit in ${total} years. Each half-life is $\\frac{${total}}{${n}}=${H}$ years.`,
    desmos: `y=(0.5)^(x/${H})`,
    skill_note: 'Count the exponent in 1/2^n, then divide the total time by that count.',
    check: `${n}*${H}=${total} and (1/2)^${n}=1/${Math.pow(2, n)}.`,
  };
}

// 25. Function notation
function fFnNotation(d, type) {
  const a = pick([1, 2, 3, -1, -2]);
  const b = pick([-5, -4, -3, 3, 4, 5]);
  const c = nz([6, 7, 8, 9, 10][d]);
  const k = pick([-3, -2, -1, 2, 3]);
  const val = a * k * k + b * k + c;
  need(a * k * k + b * k + c === val, 'fn');
  const skill = 'Function notation';
  const desmos = `y=${poly(a, b, c)}`;
  const wrongs = [
    { text: String(a * k * k - b * k + c), note: 'used the wrong sign on the linear term', tag: 'sign' },
    { text: String(-a * k * k + b * k + c), note: 'evaluated the square as negative', tag: 'algebra' },
    { text: String(a * k * k + b * k - c), note: 'subtracted the constant instead of adding', tag: 'sign' },
  ];
  if (type === 'spr') {
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=${poly(a, b, c)}$. What is the value of $f(${k})$?`,
      correct: String(val),
      wrong: [],
      spr: [String(val)],
      explanation: `Substitute $x=${k}$: $f(${k})=${a}(${k})^2${b >= 0 ? '+' : '-'}${Math.abs(b)}(${k})${c >= 0 ? '+' : '-'}${Math.abs(c)}=${val}$. Square the input first, then apply the coefficient and the sign of the linear term.`,
      desmos,
      skill_note: 'A negative input makes both the squared term positive and the sign of bx flip.',
      check: `evaluated term by term: ${a}*${k * k}=${a * k * k}, ${b}*${k}=${b * k}, plus ${c} gives ${val}.`,
    };
  }
  return {
    skill,
    stem: `The function $f$ is defined by $f(x)=${poly(a, b, c)}$. What is the value of $f(${k})$?`,
    correct: String(val),
    wrong: wrongs,
    explanation: `$f(${k})=${a}(${k})^2${b >= 0 ? '+' : '-'}${Math.abs(b)}(${k})${c >= 0 ? '+' : '-'}${Math.abs(c)}=${val}$. Square the input first, then apply the coefficient and the sign of the linear term.`,
    desmos,
    skill_note: 'Substitute with parentheses around the negative input so the square stays positive.',
    check: `recomputed ${a}*${k}^2 + ${b}*${k} + ${c} = ${val}.`,
  };
}

// 26. Function composition
function fComposition(d, type) {
  const m = pick([2, 3, -2, 4]);
  const k = pick([-4, -3, -2, 2, 3, 5]);
  const c = pick([-3, -2, 2, 3, 4]);
  const p = pick([-3, -2, -1, 1, 2]);
  const g = p * p + c;
  const val = m * g + k;
  need(m * (p * p + c) + k === val, 'comp');
  const skill = 'Function composition';
  const desmos = `y=${lineExpr(m, k)}; y=x^2${c >= 0 ? '+' : '-'}${Math.abs(c)}`;
  if (type === 'spr') {
    return {
      skill,
      stem: `The functions $f$ and $g$ are defined by $f(x)=${m}x${k >= 0 ? '+' : '-'}${Math.abs(k)}$ and $g(x)=x^2${c >= 0 ? '+' : '-'}${Math.abs(c)}$. What is the value of $f(g(${p}))$?`,
      correct: String(val),
      wrong: [],
      spr: [String(val)],
      explanation: `First $g(${p})=${p}^2${c >= 0 ? '+' : '-'}${Math.abs(c)}=${g}$. Then $f(${g})=${m}(${g})${k >= 0 ? '+' : '-'}${Math.abs(k)}=${val}$. The inner function is always evaluated first.`,
      desmos,
      skill_note: 'Work inside out: evaluate the inner function fully before applying the outer one.',
      check: `computed g(${p})=${g} and f(${g})=${val}.`,
    };
  }
  return {
    skill,
    stem: `The functions $f$ and $g$ are defined by $f(x)=${m}x${k >= 0 ? '+' : '-'}${Math.abs(k)}$ and $g(x)=x^2${c >= 0 ? '+' : '-'}${Math.abs(c)}$. What is the value of $f(g(${p}))$?`,
    correct: String(val),
    wrong: [
      { text: String(m * p + k + p * p + c), note: 'added the two function values instead of composing', tag: 'concept' },
      { text: String(p * p + c), note: 'stopped after evaluating g', tag: 'misread' },
      { text: String(m * (p + c) + k), note: 'applied f to x + c instead of x^2 + c', tag: 'algebra' },
    ],
    explanation: `$g(${p})=${g}$, then $f(${g})=${m}(${g})${k >= 0 ? '+' : '-'}${Math.abs(k)}=${val}$. Substituting the inner output into f, rather than combining the rules, gives the value.`,
    desmos,
    skill_note: 'Composition is not multiplication or addition of the two functions.',
    check: `computed the inner value g(${p})=${g} first, then f(${g})=${val}.`,
  };
}

// 27. Inverse functions
function fInverse(d, type) {
  const skill = 'Inverse functions';
  const a = pick([2, 3, 4, 5, -2, -3]);
  const b = pick([-6, -4, -3, 3, 4, 6]);
  const k = pick([7, 9, 11, 13, 15, 20]);
  const num = k - b;
  if (num % a !== 0) return null;
  const inv = num / a;
  need(a * inv + b === k, 'inv');
  if (type === 'spr') {
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}$. What is the value of $f^{-1}(${k})$?`,
      correct: String(inv),
      wrong: [],
      spr: [String(inv)],
      explanation: `Set $y=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}$ and solve for $x$: $x=\\frac{y${b >= 0 ? '-' : '+'}${Math.abs(b)}}{${a}}$. At $y=${k}$, $x=\\frac{${num}}{${a}}=${inv}$.`,
      desmos: `y=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}`,
      skill_note: 'f-inverse asks for the input that produces the given output; solve for x.',
      check: `f(${inv})=${a}(${inv})${b >= 0 ? '+' : '-'}${Math.abs(b)}=${k}; the inverse returns the input that produces ${k}.`,
    };
  }
  if (chance(0.5)) {
    const h = pick([-4, -3, 2, 3, 5]);
    const kk = pick([-3, -2, 2, 3, 4]);
    return {
      skill,
      stem: `The function $f$ is defined by $f(x)=\\frac{${a}}{x${h >= 0 ? '-' : '+'}${Math.abs(h)}}${kk >= 0 ? '+' : '-'}${Math.abs(kk)}$, for $x\\neq${h}$. Which expression gives $f^{-1}(x)$?`,
      correct: `$${h}+\\frac{${a}}{x${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}$`,
      wrong: [
        { text: `$${h}-\\frac{${a}}{x${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}$`, note: 'subtracted the reciprocal term', tag: 'sign' },
        { text: `$${-h}+\\frac{${a}}{x${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}$`, note: 'flipped the sign of the horizontal shift', tag: 'sign' },
        { text: `$\\frac{x${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}{${a}}${constC(h)}$`, note: 'inverted the fraction instead of solving for x', tag: 'algebra' },
      ],
      explanation: `Write $y=\\frac{${a}}{x${h >= 0 ? '-' : '+'}${Math.abs(h)}}${kk >= 0 ? '+' : '-'}${Math.abs(kk)}$, so $y${kk >= 0 ? '-' : '+'}${Math.abs(kk)}=\\frac{${a}}{x${h >= 0 ? '-' : '+'}${Math.abs(h)}}$ and $x${h >= 0 ? '-' : '+'}${Math.abs(h)}=\\frac{${a}}{y${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}$. Thus $f^{-1}(x)=${h}+\\frac{${a}}{x${kk >= 0 ? '-' : '+'}${Math.abs(kk)}}$.`,
      desmos: `y=${a}/(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${kk >= 0 ? '+' : '-'}${Math.abs(kk)}`,
      skill_note: 'Swap x and y, then isolate y; the horizontal and vertical shifts trade places.',
      check: `tested a numeric point: f(${h + 1})=${a + kk}, and f^{-1}(${a + kk})=${h + 1}.`,
    };
  }
  return {
    skill,
    stem: `The function $f$ is defined by $f(x)=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}$. What is the value of $f^{-1}(${k})$?`,
    correct: String(inv),
    wrong: [
      { text: String(a * k + b), note: 'evaluated f instead of its inverse', tag: 'misread' },
      { text: String(k + b), note: 'forgot to divide by the coefficient', tag: 'algebra' },
      { text: String(-inv), note: 'flipped the sign of the result', tag: 'sign' },
    ],
    explanation: `Solving $y=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}$ for $x$ gives $x=\\frac{y${b >= 0 ? '-' : '+'}${Math.abs(b)}}{${a}}$, so $f^{-1}(${k})=\\frac{${num}}{${a}}=${inv}$.`,
    desmos: `y=${a}x${b >= 0 ? '+' : '-'}${Math.abs(b)}`,
    skill_note: 'Do not confuse f-inverse with 1/f; undo the operations in reverse order.',
    check: `f(${inv})=${a}(${inv})${b >= 0 ? '+' : '-'}${Math.abs(b)}=${k}; verified in both directions.`,
  };
}

// 28. Graph transformations
function fTransform(d, type) {
  const h = pick([-5, -4, -3, 3, 4, 5]);
  const k = pick([-4, -3, -2, 2, 3, 4]);
  const skill = 'Graph transformations';
  if (type === 'spr') {
    const t = pick([1, 2, 3]);
    const fv = pick([4, 5, 7, 9, 11]);
    const gv = fv + k;
    const x = t + h;
    need(gv === fv + k, 'shift');
    return {
      skill,
      stem: `The function $g$ is defined by $g(x)=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}$. If $f(${t})=${fv}$, what is the value of $g(${x})$?`,
      correct: String(gv),
      wrong: [],
      spr: [String(gv)],
      explanation: `The input that makes the inner expression ${t} is $x=${t}${h >= 0 ? '+' : '-'}${Math.abs(h)}=${x}$. Then $g(${x})=f(${t})${k >= 0 ? '+' : '-'}${Math.abs(k)}=${fv}${k >= 0 ? '+' : '-'}${Math.abs(k)}=${gv}$.`,
      desmos: `y=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}`,
      skill_note: 'f(x-h) shifts the graph h units right, so the same output appears at a larger input.',
      check: `g(${x}) = f(${x}${h >= 0 ? '-' : '+'}${Math.abs(h)}) + ${k} = f(${t}) + ${k} = ${gv}.`,
    };
  }
  const correct = `$g(x)=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}$`;
  return {
    skill,
    stem: `The graph of $g$ is obtained by shifting the graph of $f$ ${Math.abs(h)} units to the ${h > 0 ? 'right' : 'left'} and ${Math.abs(k)} units ${k > 0 ? 'up' : 'down'}. Which equation defines $g$ in terms of $f$?`,
    correct,
    wrong: [
      { text: `$g(x)=f(x${h >= 0 ? '+' : '-'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}$`, note: 'shifted horizontally in the wrong direction', tag: 'sign' },
      { text: `$g(x)=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '-' : '+'}${Math.abs(k)}$`, note: 'shifted vertically in the wrong direction', tag: 'sign' },
      { text: `$g(x)=f(x${h >= 0 ? '+' : '-'}${Math.abs(h)})${k >= 0 ? '-' : '+'}${Math.abs(k)}$`, note: 'reversed both shifts', tag: 'concept' },
    ],
    explanation: `A right shift by ${Math.abs(h)} replaces $x$ with $x-${Math.abs(h)}$ (left shift uses $x+${Math.abs(h)}$), and a vertical shift by $${k}$ adds $${k}$ outside. So $g(x)=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}$.`,
    desmos: `y=f(x${h >= 0 ? '-' : '+'}${Math.abs(h)})${k >= 0 ? '+' : '-'}${Math.abs(k)}`,
    skill_note: 'Horizontal shifts use the opposite sign inside the parentheses; vertical shifts keep their sign outside.',
    check: `checked the anchor point (0,0) maps to (${h},${k}) under the stated shift and under the equation.`,
  };
}

// 29. Equivalent forms of quadratics
function fEquivalent(d, type) {
  const a = pick([2, 3, 4]);
  const h = nz(5);
  const k = nz(6);
  const A = a;
  const B = -2 * a * h;
  const C = a * h * h + k;
  need(-B / (2 * a) === h && C - a * h * h === k, 'equiv');
  need(Math.abs(B) <= 60 && Math.abs(C) <= 100, 'size');
  const skill = 'Equivalent forms of quadratics';
  const coefs = (hh, kk) => [a, -2 * a * hh, a * hh * hh + kk];
  const variants = [
    [h, k],
    [-h, k],
    [h, -k],
    [-h, -k],
  ].map(([hh, kk]) => coefs(hh, kk));
  need(new Set(variants.map((v) => v.join(','))).size === 4, 'distinct');
  const vf = (hh, kk) => `$${a}(x${hh >= 0 ? '-' : '+'}${Math.abs(hh)})^2${kk >= 0 ? '+' : '-'}${Math.abs(kk)}$`;
  if (type === 'spr') {
    return {
      skill,
      stem: `The expression $${poly(A, B, C)}$ can be written in the form $a(x-h)^2+k$. What is the value of $h$?`,
      correct: String(h),
      wrong: [],
      spr: [String(h)],
      explanation: `Complete the square: $${poly(A, B, C)}=${a}(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)}$, so $h=${h}$ and $k=${k}$.`,
      desmos: `y=${poly(A, B, C)}`,
      skill_note: 'In a(x-h)^2+k the h is the vertex x-coordinate, which is -b/(2a).',
      check: `expanded ${a}(x${h >= 0 ? '-' : '+'}${Math.abs(h)})^2${k >= 0 ? '+' : '-'}${Math.abs(k)} and recovered ${poly(A, B, C)}.`,
    };
  }
  return {
    skill,
    stem: `Which expression is equivalent to $${poly(A, B, C)}$?`,
    correct: vf(h, k),
    wrong: [
      { text: vf(-h, k), note: 'flipped the sign of h', tag: 'sign' },
      { text: vf(h, -k), note: 'flipped the sign of k', tag: 'sign' },
      { text: vf(-h, -k), note: 'flipped both signs', tag: 'sign' },
    ],
    explanation: `Complete the square: $${poly(A, B, C)}=${a}\\left(x${h >= 0 ? '-' : '+'}${Math.abs(h)}\\right)^2${k >= 0 ? '+' : '-'}${Math.abs(k)}$. Expanding the right side reproduces all three coefficients.`,
    desmos: `y=${poly(A, B, C)}`,
    skill_note: 'Expand each candidate and compare all three coefficients, not just the constant.',
    check: `expanded all four vertex forms; only ${vf(h, k)} reproduces (${A},${B},${C}).`,
  };
}

// 30. Exponential vs linear growth
function fExpLinear(d, type) {
  const skill = 'Exponential vs linear growth';
  const isExp = chance(0.5);
  const a = pick([2, 3, 4, 5, 6, 8]);
  let vals;
  let b = 1;
  let dd = 0;
  if (isExp) {
    b = pick([2, 3]);
    vals = [0, 1, 2, 3].map((t) => a * Math.pow(b, t));
  } else {
    dd = pick([3, 4, 5, 6, 7]);
    vals = [0, 1, 2, 3].map((t) => a + dd * t);
  }
  if (isExp) {
    need(vals[1] / vals[0] === b && vals[2] / vals[1] === b, 'ratio');
  } else {
    need(vals[1] - vals[0] === dd && vals[2] - vals[1] === dd, 'diff');
  }
  const table = `At $t=0,1,2,3$ the values are $${vals.join(', ')}$.`;
  if (type === 'spr') {
    if (isExp) {
      return {
        skill,
        stem: `A quantity $f(t)$ is recorded at integer times. ${table} The values are exponential. By what factor does $f$ multiply each time $t$ increases by 1?`,
        correct: String(b),
        wrong: [],
        spr: [String(b)],
        explanation: `Successive ratios are $\\frac{${vals[1]}}{${vals[0]}}=${b}$, $\\frac{${vals[2]}}{${vals[1]}}=${b}$, so the growth factor is $${b}$.`,
        desmos: `y=${a}(${b})^x`,
        skill_note: 'For exponential data, divide consecutive outputs; for linear data, subtract them.',
        check: `computed both ratios: ${vals[1]}/${vals[0]}=${b}, ${vals[2]}/${vals[1]}=${b}.`,
      };
    }
    return {
      skill,
      stem: `A quantity $f(t)$ is recorded at integer times. ${table} The values are linear. By how much does $f$ increase each time $t$ increases by 1?`,
      correct: String(dd),
      wrong: [],
      spr: [String(dd)],
      explanation: `The differences are $${vals[1]}-${vals[0]}=${dd}$ and $${vals[2]}-${vals[1]}=${dd}$, so $f$ increases by $${dd}$ per unit of $t$.`,
      desmos: `y=${a}+${dd}x`,
      skill_note: 'Linear data have a constant difference; exponential data have a constant ratio.',
      check: `computed both differences: ${vals[1] - vals[0]} and ${vals[2] - vals[1]}.`,
    };
  }
  const correct = isExp ? `$f(t)=${a}(${b})^t$` : `$f(t)=${a}+${dd}t$`;
  const wrongs = isExp
    ? [
        { text: `$f(t)=${a}+${dd || 2}t$`, note: 'modeled the constant ratio as a constant difference', tag: 'concept' },
        { text: `$f(t)=${a}(${b + 1})^t$`, note: 'added one to the growth factor', tag: 'algebra' },
        { text: `$f(t)=${vals[3]}(${b})^t$`, note: 'used the last value as the initial value', tag: 'setup' },
      ]
    : [
        { text: `$f(t)=${a}(${b + 1})^t$`, note: 'modeled the constant difference as a constant ratio', tag: 'concept' },
        { text: `$f(t)=${a}+${dd}t+1$`, note: 'misread the starting value', tag: 'arithmetic' },
        { text: `$f(t)=${dd}+${a}t$`, note: 'swapped the starting value and the rate', tag: 'setup' },
      ];
  return {
    skill,
    stem: `A quantity $f(t)$ is recorded at integer times. ${table} Which function fits the data?`,
    correct,
    wrong: wrongs,
    explanation: `The consecutive ${isExp ? 'ratios' : 'differences'} are constant (${isExp ? `each output is ${b} times the previous` : `each output is ${dd} more than the previous`}), and $f(0)=${a}$. So ${correct}.`,
    desmos: isExp ? `y=${a}(${b})^x` : `y=${a}+${dd}x`,
    skill_note: 'Check whether the table multiplies or adds by a constant; then anchor at t = 0.',
    check: `tested all four table values against ${correct}.`,
  };
}

// 31. Quadratic inequalities and parameter ranges
function fParamRange(d, type) {
  const m = ri([2, 3, 4, 5, 6][d], [4, 5, 6, 7, 8][d]);
  const c = m * m;
  const skill = 'Quadratic inequalities and parameter ranges';
  const desmos = `y=x^2+${2 * m}x+${c}`;
  const kind = type === 'spr' ? pick(['two', 'none']) : pick(['none', 'two', 'one']);
  if (type === 'spr') {
    if (kind === 'two') {
      return {
        skill,
        stem: `The equation $x^2+kx+${c}=0$ has two distinct real solutions. What is the smallest positive integer value of $k$ that satisfies this condition?`,
        correct: String(2 * m + 1),
        wrong: [],
        spr: [String(2 * m + 1)],
        explanation: `Two distinct real solutions need $k^2-4(${c})>0$, so $k^2>${4 * c}$ and $|k|>${2 * m}$. The smallest positive integer satisfying $k>${2 * m}$ is $${2 * m + 1}$.`,
        desmos,
        skill_note: 'Two distinct real solutions require a strictly positive discriminant, which gives a strict inequality.',
        check: `tested k=${2 * m}: discriminant ${(2 * m) ** 2 - 4 * c} (not positive), and k=${2 * m + 1}: discriminant ${(2 * m + 1) ** 2 - 4 * c} > 0.`,
      };
    }
    return {
      skill,
      stem: `The equation $x^2+kx+${c}=0$ has no real solutions. What is the greatest integer value of $k$?`,
      correct: String(2 * m - 1),
      wrong: [],
      spr: [String(2 * m - 1)],
      explanation: `No real solutions means $k^2-4(${c})<0$, so $|k|<${2 * m}$ and $-${2 * m}<k<${2 * m}$. The greatest integer in that interval is $${2 * m - 1}$.`,
      desmos,
      skill_note: 'No real solutions means a negative discriminant, which gives an open interval for k.',
      check: `checked k=${2 * m - 1} (discriminant ${(2 * m - 1) ** 2 - 4 * c}) and k=${2 * m} (discriminant 0).`,
    };
  }
  const opts = {
    none: {
      stem: `For which values of $k$ does the equation $x^2+kx+${c}=0$ have no real solutions?`,
      correct: `$-${2 * m}<k<${2 * m}$`,
      wrong: [
        { text: `$k<-${2 * m}$ or $k>${2 * m}$`, note: 'chose where the discriminant is positive', tag: 'concept' },
        { text: `$-${c}<k<${c}$`, note: 'compared k^2 with c instead of 4c', tag: 'algebra' },
        { text: `$k<${2 * m}$`, note: 'used a one-sided inequality', tag: 'misread' },
      ],
      explanation: `No real solutions means $k^2-4(${c})<0$, so $k^2<${4 * c}$ and $|k|<${2 * m}$. Thus $-${2 * m}<k<${2 * m}$.`,
    },
    two: {
      stem: `For which values of $k$ does the equation $x^2+kx+${c}=0$ have two distinct real solutions?`,
      correct: `$k<-${2 * m}$ or $k>${2 * m}$`,
      wrong: [
        { text: `$-${2 * m}<k<${2 * m}$`, note: 'chose where the discriminant is negative', tag: 'concept' },
        { text: `$-${c}<k<${c}$`, note: 'used c instead of 4c in the discriminant', tag: 'algebra' },
        { text: `$k>${2 * m}$`, note: 'kept only one side of the solution', tag: 'misread' },
      ],
      explanation: `Two distinct real solutions means $k^2-4(${c})>0$, so $k^2>${4 * c}$ and $|k|>${2 * m}$. Thus $k<-${2 * m}$ or $k>${2 * m}$.`,
    },
    one: {
      stem: `For which values of $k$ does the equation $x^2+kx+${c}=0$ have exactly one real solution?`,
      correct: `$k=${2 * m}$ or $k=${-2 * m}$`,
      wrong: [
        { text: `$k=${2 * m}$ only`, note: 'dropped the negative solution', tag: 'sign' },
        { text: `$-${2 * m}<k<${2 * m}$`, note: 'gave the no-solution interval', tag: 'concept' },
        { text: `$k=${c}$`, note: 'used c instead of 2 times its root', tag: 'algebra' },
      ],
      explanation: `Exactly one real solution means the discriminant is zero: $k^2-4(${c})=0$, so $k^2=${4 * c}$ and $k=\\pm${2 * m}$.`,
    },
  }[kind];
  return {
    skill,
    stem: opts.stem,
    correct: opts.correct,
    wrong: opts.wrong,
    explanation: opts.explanation,
    desmos,
    skill_note: 'Translate the number of solutions into a sign condition on b^2 - 4ac, then solve for k.',
    check: `tested k=0, k=${2 * m} and k=${2 * m + 1} in the discriminant ${4 * c} and confirmed the stated range.`,
  };
}

/* ============================================================
   SCHEDULER
   ============================================================ */

const FAMILIES = [
  fFactorMonic,
  fFactorLead,
  fQuadFormula,
  fCompleteSquare,
  fVertexForm,
  fVertexStandard,
  fAxis,
  fDiscriminant,
  fSumProduct,
  fArea,
  fProjectile,
  fRevenue,
  fLineParabola,
  fNonlinearSystem,
  fRemainder,
  fFactorTheorem,
  fRationalSimplify,
  fRationalEquation,
  fRadical,
  fGrowth,
  fDecay,
  fModelParam,
  fExpFit,
  fHalfLife,
  fFnNotation,
  fComposition,
  fInverse,
  fTransform,
  fEquivalent,
  fExpLinear,
  fParamRange,
];

// Difficulty band per family (index matches FAMILIES): [minLevel, maxLevel]
const BANDS = [
  [0, 2], // factoring monic
  [1, 3], // leading coefficient
  [0, 3], // quadratic formula
  [0, 2], // completing the square
  [0, 2], // vertex form
  [1, 3], // vertex from standard form
  [0, 2], // axis of symmetry
  [0, 4], // discriminant
  [0, 4], // sum and product
  [0, 3], // area
  [1, 4], // projectile
  [1, 4], // revenue
  [1, 4], // line-parabola
  [1, 4], // nonlinear systems
  [1, 4], // remainder theorem
  [1, 4], // factor theorem
  [1, 3], // rational simplify
  [1, 4], // rational equations
  [2, 4], // radical equations
  [0, 2], // exponential growth
  [0, 2], // exponential decay
  [1, 3], // model parameters
  [1, 3], // exponential fit
  [0, 3], // half-life
  [0, 2], // function notation
  [1, 3], // composition
  [1, 3], // inverse
  [1, 3], // transformations
  [1, 3], // equivalent forms
  [0, 2], // exponential vs linear
  [1, 4], // parameter ranges
];

const DIFFS = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
const DIDX = { easy: 0, medium: 1, hard: 2, very_hard: 3, extreme: 4 };

function quotas(n) {
  const easy = Math.round(n * 0.25);
  const medium = Math.round(n * 0.3);
  const hard = Math.round(n * 0.25);
  const vh = Math.round(n * 0.15);
  const ext = n - (easy + medium + hard + vh);
  return { easy, medium, hard, very_hard: vh, extreme: ext };
}

export function generate(opts = {}) {
  const count = opts.count ?? 348;
  const seed = opts.seed ?? 20261115;
  rnd = mulberry32(seed);
  const q = quotas(count);
  const diffDeck = shuffle(
    Object.entries(q).flatMap(([d, n]) => Array(Math.max(0, n)).fill(d))
  ).slice(0, count);
  const mcqN = Math.round(count * 0.75);
  const typeDeck = shuffle([
    ...Array(mcqN).fill('mcq'),
    ...Array(count - mcqN).fill('spr'),
  ]);
  const items = [];
  const seen = new Set();
  const used = new Array(FAMILIES.length).fill(0);
  const failures = [];
  let ptr = 0;
  let guard = 0;
  while (items.length < count && guard < count * 400) {
    guard++;
    const diff = diffDeck[items.length] || 'medium';
    const type = typeDeck[items.length] || 'mcq';
    let placed = false;
    // prefer families whose difficulty band covers this slot, then fall back
    const inBand = [];
    const outBand = [];
    for (let k = 0; k < FAMILIES.length; k++) {
      const i = (ptr + k) % FAMILIES.length;
      if (DIDX[diff] >= BANDS[i][0] && DIDX[diff] <= BANDS[i][1]) inBand.push(i);
      else outBand.push(i);
    }
    // least-used first, then rotation order, so every family contributes
    const rank = (i, k) => used[i] * 1000 + ((i - ptr + FAMILIES.length) % FAMILIES.length);
    inBand.sort((a, b) => rank(a) - rank(b));
    outBand.sort((a, b) => rank(a) - rank(b));
    const order = inBand.concat(outBand);
    for (let k = 0; k < order.length && !placed; k++) {
      const fam = FAMILIES[order[k]];
      try {
        const spec = fam(DIDX[diff], type);
        if (!spec) continue;
        const id = `ADVX-${String(items.length + 1).padStart(4, '0')}`;
        const item = makeItem(spec, diff, type, id);
        if (!item) continue;
        const key = item.stem.toLowerCase().replace(/\s+/g, ' ').trim();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        used[order[k]]++;
        ptr = (order[k] + 1) % FAMILIES.length;
        placed = true;
      } catch (e) {
        failures.push(`${fam.name}:${e.message}`);
      }
    }
  }
  return { items, failures, requested: count, seed };
}

/* ============================================================
   VALIDATION
   ============================================================ */

const VOCAB = new Set(['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none']);

export function validate(items) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!Array.isArray(items)) return { ok: false, errors: ['items is not an array'], stats: {} };
  if (items.length < 340) err(`count ${items.length} < 340`);
  const ids = new Set();
  const stems = new Set();
  const byDiff = {};
  const byType = { mcq: 0, spr: 0 };
  const bySkill = {};
  for (const it of items) {
    const tag = it.id;
    if (!it.id || typeof it.id !== 'string') err(`${tag}: missing id`);
    else if (!/^ADVX-\d{4}$/.test(it.id)) err(`${tag}: bad id format`);
    if (ids.has(it.id)) err(`${tag}: duplicate id`);
    ids.add(it.id);
    for (const f of ['section', 'domain', 'skill', 'difficulty', 'type', 'stem', 'explanation', 'desmos', 'skill_note', 'check']) {
      if (typeof it[f] !== 'string' || it[f].length === 0) err(`${tag}: missing/empty ${f}`);
    }
    if (it.section !== 'math') err(`${tag}: section`);
    if (it.domain !== 'Advanced Math') err(`${tag}: domain`);
    if (it.skill && !bySkill[it.skill]) bySkill[it.skill] = 0;
    if (it.skill) bySkill[it.skill]++;
    if (!DIFFS.includes(it.difficulty)) err(`${tag}: bad difficulty ${it.difficulty}`);
    byDiff[it.difficulty] = (byDiff[it.difficulty] || 0) + 1;
    if (it.type === 'mcq') {
      byType.mcq++;
      if (!Array.isArray(it.choices) || it.choices.length !== 4) err(`${tag}: choices != 4`);
      else {
        if (new Set(it.choices).size !== 4) err(`${tag}: duplicate choices`);
        for (const c of it.choices) if (typeof c !== 'string' || !c.length) err(`${tag}: bad choice`);
      }
      if (!['A', 'B', 'C', 'D'].includes(it.answer)) err(`${tag}: answer ${it.answer}`);
      if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) err(`${tag}: notes != 4`);
      if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) err(`${tag}: tags != 4`);
      if (Array.isArray(it.choice_notes) && it.choice_notes.filter((n) => n === 'correct').length !== 1) err(`${tag}: correct-note count`);
      if (Array.isArray(it.error_tags)) {
        for (const t of it.error_tags) if (!VOCAB.has(t)) err(`${tag}: bad tag ${t}`);
        const ai = 'ABCD'.indexOf(it.answer);
        if (ai >= 0 && it.error_tags[ai] !== 'none') err(`${tag}: key tag not none`);
        if (it.error_tags.filter((t) => t === 'none').length !== 1) err(`${tag}: none-count`);
      }
      if ('accepted_spr' in it) err(`${tag}: accepted_spr on mcq`);
    } else if (it.type === 'spr') {
      byType.spr++;
      if (!Array.isArray(it.accepted_spr) || it.accepted_spr.length === 0) err(`${tag}: no accepted_spr`);
      else if (new Set(it.accepted_spr).size !== it.accepted_spr.length) err(`${tag}: duplicate accepted_spr`);
      if ('choices' in it || 'answer' in it) err(`${tag}: mcq fields on spr`);
    } else {
      err(`${tag}: bad type ${it.type}`);
    }
    for (const f of ['stem', 'explanation', 'desmos', 'skill_note', 'check', ...(it.choices || []), ...(it.choice_notes || [])]) {
      if (typeof f !== 'string') continue;
      const dollars = (f.replace(/\\\$/g, '').match(/\$/g) || []).length;
      if (dollars % 2 !== 0) err(`${tag}: unbalanced $ in "${f.slice(0, 40)}"`);
      if (/\n/.test(f)) err(`${tag}: raw newline in field`);
    }
    const stemKey = String(it.stem).toLowerCase().replace(/\s+/g, ' ').trim();
    if (stems.has(stemKey)) err(`${tag}: duplicate stem`);
    stems.add(stemKey);
    if (it.explanation && (it.explanation.length < 40 || it.explanation.length > 700)) err(`${tag}: explanation length ${it.explanation.length}`);
    if (it.check && it.check.length < 20) err(`${tag}: check too short`);
  }
  const blob = JSON.stringify(items);
  for (const bad of ['NaN', 'undefined', 'Infinity', 'null']) {
    if (blob.includes(bad)) err(`file contains ${bad}`);
  }
  const total = items.length || 1;
  const diffsOk = DIFFS.every((d) => {
    const p = (byDiff[d] || 0) / total;
    const target = { easy: 0.25, medium: 0.3, hard: 0.25, very_hard: 0.15, extreme: 0.05 }[d];
    return Math.abs(p - target) <= 0.03;
  });
  if (!diffsOk) err(`difficulty distribution off: ${JSON.stringify(byDiff)}`);
  const typesOk = Math.abs(byType.mcq / total - 0.75) <= 0.03;
  if (!typesOk) err(`type distribution off: ${JSON.stringify(byType)}`);
  return {
    ok: errors.length === 0,
    errors,
    stats: {
      count: items.length,
      byDiff,
      byType,
      skills: Object.keys(bySkill),
      skillCount: Object.keys(bySkill).length,
      skillSpread: bySkill,
      diffPct: Object.fromEntries(DIFFS.map((d) => [d, Math.round(((byDiff[d] || 0) / total) * 1000) / 10])),
      typePct: { mcq: Math.round((byType.mcq / total) * 1000) / 10, spr: Math.round((byType.spr / total) * 1000) / 10 },
    },
  };
}

/* ============================================================
   CLI
   ============================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'math-advanced.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { items, failures, seed } = generate();
  const report = validate(items);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ items }, null, 2) + '\n');
  console.log(`seed: ${seed}`);
  console.log(`wrote: ${OUT}`);
  console.log(`items: ${report.stats.count}`);
  console.log(`difficulty: ${JSON.stringify(report.stats.byDiff)}  (${JSON.stringify(report.stats.diffPct)}%)`);
  console.log(`type: ${JSON.stringify(report.stats.byType)}  (${JSON.stringify(report.stats.typePct)}%)`);
  console.log(`distinct skills: ${report.stats.skillCount}`);
  console.log(report.stats.skills.join(' | '));
  console.log(`build retries logged: ${failures.length}`);
  if (!report.ok) {
    console.log(`VALIDATION FAILED (${report.errors.length})`);
    for (const e of report.errors.slice(0, 40)) console.log('  - ' + e);
    process.exitCode = 1;
  } else {
    console.log('VALIDATION PASSED: ids unique, 4 choices/notes/tags per mcq, answers A-D, $ balanced, no NaN/undefined/Infinity, distributions within tolerance');
  }
}
