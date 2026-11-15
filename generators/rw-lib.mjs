// Shared deterministic machinery for the Reading & Writing generators.
// No Math.random() anywhere: every random-looking decision comes from one
// seeded mulberry32 stream, consumed in a fixed order, so output is byte-stable.

export const SEED = 0x5a7b1c3;

export function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DIFFS = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
export const DIFF_WEIGHTS = { easy: 0.30, medium: 0.35, hard: 0.20, very_hard: 0.10, extreme: 0.05 };
export const DIFF_RANK = { easy: 1, medium: 2, hard: 3, very_hard: 4, extreme: 5 };

// Largest-remainder allocation of n slots over DIFFS by weight.
export function quotaFor(n) {
  const raw = DIFFS.map((d) => n * DIFF_WEIGHTS[d]);
  const base = raw.map((v) => Math.floor(v));
  let left = n - base.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < left; k++) base[order[k % 5].i] += 1;
  const out = {};
  DIFFS.forEach((d, i) => { out[d] = base[i]; });
  return out;
}

const LETTERS = ['A', 'B', 'C', 'D'];

// Draft -> final item. A draft carries one correct option and three wrong ones,
// each wrong option annotated with why a student would pick it.
//   draft = { skill, domain, passage, stem, correct, wrongs:[{text,note,tag}],
//             explanation, skill_note, lvl, difficulty? }
export function finalize(drafts, opts = {}) {
  const seed = opts.seed ?? SEED;
  const rng = mulberry32(seed ^ 0x9e3779b9);

  // Group by skill, order inside a skill by intrinsic level, then hand out
  // difficulty labels from the largest-remainder quota so global proportions
  // land on 30/35/20/10/5 regardless of how many items each skill has.
  const bySkill = new Map();
  for (const d of drafts) {
    if (!bySkill.has(d.skill)) bySkill.set(d.skill, []);
    bySkill.get(d.skill).push(d);
  }

  const ordered = [];
  for (const [skill, list] of bySkill) {
    const sorted = list
      .map((d, i) => ({ d, i }))
      .sort((a, b) => a.d.lvl - b.d.lvl || a.i - b.i)
      .map((x) => x.d);
    const q = quotaFor(sorted.length);
    let cursor = 0;
    for (const diff of DIFFS) {
      for (let k = 0; k < q[diff]; k++) {
        const d = sorted[cursor++];
        ordered.push({ ...d, difficulty: d.difficulty ?? diff });
      }
    }
  }

  // Balanced answer-key rotation: blocks of four letters, permuted per block.
  const n = ordered.length;
  const positions = [];
  for (let block = 0; block * 4 < n; block++) {
    const blockLen = Math.min(4, n - block * 4);
    const letters = shuffle(LETTERS.slice(0, 4), rng).slice(0, blockLen);
    positions.push(...letters);
  }

  const items = ordered.map((d, idx) => {
    const pool = [
      { text: d.correct, note: d.correctNote ?? 'correct', tag: 'none', ok: true },
      ...d.wrongs.map((w) => ({ text: w.text, note: w.note, tag: w.tag, ok: false })),
    ];
    if (pool.length !== 4) throw new Error(`item ${idx} has ${pool.length} options: ${d.passage.slice(0, 60)}`);
    const texts = pool.map((p) => p.text.trim());
    if (new Set(texts).size !== 4) throw new Error(`dup choice text in item ${idx}: ${JSON.stringify(texts)}`);

    const target = LETTERS.indexOf(positions[idx]);
    const others = shuffle(pool.filter((p) => !p.ok), rng);
    const finalChoices = [];
    let oi = 0;
    for (let c = 0; c < 4; c++) finalChoices.push(c === target ? pool[0] : others[oi++]);

    return {
      id: 'RWW-' + String(idx + 1).padStart(4, '0'),
      section: 'rw',
      domain: d.domain,
      skill: d.skill,
      difficulty: d.difficulty,
      type: 'mcq',
      passage: d.passage,
      stem: d.stem,
      choices: finalChoices.map((c) => c.text),
      answer: positions[idx],
      choice_notes: finalChoices.map((c) => c.note),
      error_tags: finalChoices.map((c) => c.tag),
      explanation: d.explanation,
      skill_note: d.skill_note,
    };
  });

  return items;
}

const TAG_SET = new Set(['misread', 'concept', 'setup', 'quantity', 'none']);
const DOMAINS = new Set(['Craft and Structure', 'Expression of Ideas', 'Information and Ideas']);

// ---- table helpers -------------------------------------------------------
// Table items are built from structured data so the numbers in the prose and
// the numbers in the table can never drift apart.
export function renderTable(col0, col1, rows, unitLabel = '') {
  const head = unitLabel ? `${col0} | ${col1} (${unitLabel})` : `${col0} | ${col1}`;
  const body = rows.map((r) => `${r[0]} | ${r[1]}`).join('\n');
  return `${head}\n---|---\n${body}`;
}

export function parseTable(stem) {
  const lines = stem.split('\n');
  const sepIdx = lines.findIndex((l) => /^\s*-{3,}\s*\|\s*-{3,}\s*$/.test(l));
  if (sepIdx < 1) return null;
  const header = lines[sepIdx - 1].split('|').map((s) => s.trim());
  const rows = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    if (!line.includes('|')) break;
    rows.push(line.split('|').map((s) => s.trim()));
  }
  return { header, rows };
}

export function validate(items, opts = {}) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const sigs = new Set();
  const skillCounts = {};
  const diffCounts = {};
  const domainCounts = {};
  const answerCounts = {};
  const seenPassages = new Map();
  let tables = 0;
  let tableItems = 0;

  for (const it of items) {
    const where = it.id ?? '(no id)';
    if (ids.has(it.id)) errors.push(`${where}: duplicate id`);
    ids.add(it.id);
    if (!/^RWW-\d{4}$/.test(it.id)) errors.push(`${where}: bad id format`);

    for (const k of ['id', 'section', 'domain', 'skill', 'difficulty', 'type', 'passage', 'stem', 'choices', 'answer', 'choice_notes', 'error_tags', 'explanation', 'skill_note']) {
      if (!(k in it)) errors.push(`${where}: missing field ${k}`);
    }
    if (it.section !== 'rw') errors.push(`${where}: section must be rw`);
    if (it.type !== 'mcq') errors.push(`${where}: type must be mcq`);
    if (!DOMAINS.has(it.domain)) errors.push(`${where}: unknown domain ${it.domain}`);
    if (!DIFFS.includes(it.difficulty)) errors.push(`${where}: unknown difficulty ${it.difficulty}`);

    const words = it.passage.trim().split(/\s+/).length;
    if (words < 20) errors.push(`${where}: passage too short (${words} words)`);
    if (words > 70) errors.push(`${where}: passage too long (${words} words)`);
    if (!/\[[^\]]+\]/.test(it.passage) && it.skill === 'Words in context') {
      errors.push(`${where}: no bracketed target word`);
    }

    if (!Array.isArray(it.choices) || it.choices.length !== 4) errors.push(`${where}: need 4 choices`);
    if (new Set(it.choices).size !== 4) errors.push(`${where}: duplicate choice text`);
    if (it.choices.some((c) => !c || !String(c).trim())) errors.push(`${where}: empty choice`);
    if (!LETTERS.includes(it.answer)) errors.push(`${where}: answer must be A-D`);
    if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) errors.push(`${where}: choice_notes length`);
    if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) errors.push(`${where}: error_tags length`);

    const keyIdx = LETTERS.indexOf(it.answer);
    if (it.choice_notes[keyIdx] !== 'correct') errors.push(`${where}: choice_notes[key] must be "correct"`);
    if (it.choice_notes.filter((n) => n === 'correct').length !== 1) errors.push(`${where}: more than one "correct" note`);
    if (it.error_tags[keyIdx] !== 'none') errors.push(`${where}: error_tags[key] must be "none"`);
    for (const t of it.error_tags) if (!TAG_SET.has(t)) errors.push(`${where}: bad error tag ${t}`);

    if (!it.explanation || it.explanation.length < 40) errors.push(`${where}: explanation too thin`);
    if (!it.skill_note || it.skill_note.length < 10) errors.push(`${where}: skill_note too thin`);

    const sig = it.passage.replace(/\s+/g, ' ').trim() + '||' + it.choices.join('|');
    if (sigs.has(sig)) errors.push(`${where}: duplicate signature`);
    sigs.add(sig);
    const pkey = it.passage.replace(/\s+/g, ' ').trim();
    if (seenPassages.has(pkey)) errors.push(`${where}: duplicate passage (also ${seenPassages.get(pkey)})`);
    seenPassages.set(pkey, it.id);

    if (it.stem.includes('\n')) {
      tableItems++;
      const t = parseTable(it.stem);
      if (!t) errors.push(`${where}: table separator row missing`);
      else {
        tables++;
        const width = t.header.length;
        if (width !== 2 && width !== 3) warnings.push(`${where}: table has ${width} columns`);
        for (const r of t.rows) if (r.length !== width) errors.push(`${where}: table row width ${r.length} != ${width}`);
        if (t.rows.length < 2 || t.rows.length > 3) errors.push(`${where}: table needs 2-3 rows, has ${t.rows.length}`);
        for (const r of t.rows) {
          const num = Number(r[1]);
          if (!Number.isFinite(num)) errors.push(`${where}: non-numeric table cell "${r[1]}"`);
        }
      }
    }

    skillCounts[it.skill] = (skillCounts[it.skill] ?? 0) + 1;
    diffCounts[it.difficulty] = (diffCounts[it.difficulty] ?? 0) + 1;
    domainCounts[it.domain] = (domainCounts[it.domain] ?? 0) + 1;
    answerCounts[it.answer] = (answerCounts[it.answer] ?? 0) + 1;
  }

  if (items.length < (opts.min ?? 330)) errors.push(`count ${items.length} < ${opts.min ?? 330}`);

  const total = items.length;
  const diffTable = DIFFS.map((d) => {
    const n = diffCounts[d] ?? 0;
    const pct = total ? (n / total) * 100 : 0;
    const target = DIFF_WEIGHTS[d] * 100;
    return { difficulty: d, count: n, pct: +pct.toFixed(1), target, delta: +(pct - target).toFixed(1) };
  });
  for (const r of diffTable) if (Math.abs(r.delta) > 4) warnings.push(`${r.difficulty} share ${r.pct}% vs target ${r.target}%`);

  return { total, skillCounts, diffCounts, diffTable, domainCounts, answerCounts, tables, tableItems, errors, warnings };
}

export function report(items, v) {
  const lines = [];
  lines.push('');
  lines.push('=== VALIDATION ===============================================');
  lines.push(`items: ${v.total}`);
  lines.push('');
  lines.push('per skill:');
  for (const [k, n] of Object.entries(v.skillCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${k.padEnd(22)} ${String(n).padStart(4)}`);
  }
  lines.push('');
  lines.push('per domain:');
  for (const [k, n] of Object.entries(v.domainCounts)) lines.push(`  ${k.padEnd(22)} ${String(n).padStart(4)}`);
  lines.push('');
  lines.push('difficulty            count    share   target');
  for (const r of v.diffTable) {
    lines.push(`  ${r.difficulty.padEnd(18)} ${String(r.count).padStart(4)}   ${String(r.pct).padStart(5)}%  ${String(r.target).padStart(5)}%`);
  }
  lines.push('');
  lines.push(`answer key spread: ${JSON.stringify(v.answerCounts)}`);
  lines.push(`table items: ${v.tableItems} (${v.tables} parsed tables)`);
  lines.push(`unique ids: ${new Set(items.map((i) => i.id)).size}   unique passages: ${new Set(items.map((i) => i.passage)).size}`);
  lines.push('');
  if (v.warnings.length) {
    lines.push(`WARNINGS (${v.warnings.length}):`);
    for (const w of v.warnings) lines.push('  ! ' + w);
  } else lines.push('warnings: none');
  if (v.errors.length) {
    lines.push(`ERRORS (${v.errors.length}):`);
    for (const e of v.errors.slice(0, 40)) lines.push('  x ' + e);
  } else {
    lines.push('errors: none');
  }
  lines.push(`RESULT: ${v.errors.length === 0 ? 'PASS' : 'FAIL'}`);
  lines.push('==============================================================');
  return lines.join('\n');
}
