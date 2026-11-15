// generators/validate.mjs — independent read-back check of generated/math-data-geo.json
// Only reads the JSON: nothing is trusted from the generator's own verification.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'math-data-geo.json');
const raw = readFileSync(FILE, 'utf8');
const doc = JSON.parse(raw);
const items = doc.items;

const DIFF = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
const TAGS = ['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none'];
const errors = [];
const warn = [];
const fail = (m) => errors.push(m);

// ---------- number reading ----------
function num(s) {
  const t = String(s).replace(/\$/g, '').replace(/\{,\}/g, '').replace(/,/g, '').replace(/\\%/g, '').trim();
  if (t === '') return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}
const near = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));

// ---------- tables ----------
function parseTables(stem) {
  const lines = String(stem).split('\n');
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    if (!/^\|?[\s:|-]*-{2,}[\s:|-]*\|?$/.test(lines[i + 1] || '')) continue;
    const rows = [];
    let j = i;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      const cells = lines[j].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (!/^[\s:|-]*-{2,}[\s:|-]*$/.test(lines[j])) rows.push(cells);
      j++;
    }
    tables.push(rows);
    i = j - 1;
  }
  return tables;
}

function checkTable(rows, id, substitute) {
  const body = rows.map((r) => r.map((c) => (c === '?' ? substitute : c)));
  if (body.length < 3) return fail(`${id}: table has fewer than 2 data rows`);
  const head = body[0];
  const data = body.slice(1);
  const numeric = (c) => (c === '?' ? NaN : num(c));
  // row sums: last column is a total
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const total = numeric(row[row.length - 1]);
    if (!Number.isFinite(total)) fail(`${id}: table row ${r} has no numeric total`);
    if (row[0] === 'Total') continue;
    const parts = row.slice(1, -1).map(numeric);
    if (parts.every(Number.isFinite)) {
      const s = parts.reduce((a, b) => a + b, 0);
      if (!near(s, total)) fail(`${id}: table row "${row[0]}" sums to ${s}, total says ${total}`);
    }
  }
  // column sums: last row is a total
  const last = data[data.length - 1];
  if (last[0] !== 'Total') fail(`${id}: table has no Total row`);
  for (let c = 1; c < head.length; c++) {
    const total = numeric(last[c]);
    const parts = data.slice(0, -1).map((r) => numeric(r[c]));
    if (!Number.isFinite(total)) { fail(`${id}: table column ${c} has no numeric total`); continue; }
    if (parts.every(Number.isFinite)) {
      const s = parts.reduce((a, b) => a + b, 0);
      if (!near(s, total)) fail(`${id}: table column "${head[c]}" sums to ${s}, total says ${total}`);
    }
  }
}

// ---------- main ----------
const ids = new Set();
const domains = {};
const diffs = {};
const types = {};
const skills = {};

for (const it of items) {
  const id = it.id;
  if (!id) fail('item without id');
  if (ids.has(id)) fail(`duplicate id ${id}`);
  ids.add(id);

  for (const f of ['section', 'domain', 'skill', 'difficulty', 'type', 'stem', 'explanation', 'skill_note', 'check', 'desmos']) {
    if (it[f] == null) fail(`${id}: missing field ${f}`);
    else if (typeof it[f] !== 'string') fail(`${id}: field ${f} is not a string`);
  }
  if (it.section !== 'math') fail(`${id}: section is ${it.section}`);
  if (it.domain !== 'Problem-Solving and Data Analysis' && it.domain !== 'Geometry and Trigonometry') fail(`${id}: bad domain ${it.domain}`);
  if (!DIFF.includes(it.difficulty)) fail(`${id}: bad difficulty ${it.difficulty}`);
  if (it.type !== 'mcq' && it.type !== 'spr') fail(`${id}: bad type ${it.type}`);
  if (!it.stem || it.stem.length < 18) fail(`${id}: stem too short`);
  const words = it.explanation.trim().length;
  if (words < 60) fail(`${id}: explanation only ${words} chars`);
  if (!it.check || it.check.length < 8) fail(`${id}: check text too short`);

  domains[it.domain] = (domains[it.domain] || 0) + 1;
  diffs[it.difficulty] = (diffs[it.difficulty] || 0) + 1;
  types[it.type] = (types[it.type] || 0) + 1;
  skills[it.skill] = (skills[it.skill] || 0) + 1;

  // dollars balanced (ignore escaped \$ used for money)
  const bare = it.stem.replace(/\\\$/g, '');
  const dollars = (bare.match(/\$/g) || []).length;
  if (dollars % 2 !== 0) fail(`${id}: unbalanced $ in stem`);
  if (/\$\s*\$/.test(it.stem)) fail(`${id}: empty math span`);
  if (/\\\$\\\$/.test(it.stem)) fail(`${id}: doubled money delimiter`);
  if (/\b(NaN|undefined|Infinity|null)\b/.test(JSON.stringify(it))) fail(`${id}: NaN/undefined/Infinity/null in item`);
  if (it.stem.includes('${')) fail(`${id}: template artifact \${`);
  if (/\s{3,}/.test(it.stem)) fail(`${id}: runs of spaces in stem`);

  // tables
  const tables = parseTables(it.stem);
  for (const rows of tables) {
    let sub = '0';
    if (it.type === 'spr') sub = it.answer;
    else if (it.choices) sub = it.choices['ABCD'.indexOf(it.answer)];
    if (rows.flat().includes('?')) checkTable(rows, id, sub);
    else checkTable(rows, id, sub);
  }
  if (tables.length > 3) fail(`${id}: ${tables.length} tables in one stem`);

  if (it.type === 'mcq') {
    if (!Array.isArray(it.choices) || it.choices.length !== 4) { fail(`${id}: choices length ${it.choices && it.choices.length}`); continue; }
    if (new Set(it.choices).size !== 4) fail(`${id}: duplicate choice text`);
    if (!/^[ABCD]$/.test(it.answer)) fail(`${id}: answer ${it.answer}`);
    if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) fail(`${id}: choice_notes length`);
    if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) fail(`${id}: error_tags length`);
    if ((it.choice_notes || []).filter((n) => n === 'correct').length !== 1) fail(`${id}: choice_notes needs exactly one "correct"`);
    if ((it.error_tags || []).filter((t) => t === 'none').length !== 1) fail(`${id}: error_tags needs exactly one "none"`);
    for (const t of it.error_tags || []) if (!TAGS.includes(t)) fail(`${id}: bad tag ${t}`);
    for (const n of it.choice_notes || []) if (!n || n.length < 3) fail(`${id}: empty choice note`);
    if (it.accepted_spr) fail(`${id}: mcq has accepted_spr`);
    // numeric choices: the key must be unique among parseable values
    const keyIdx = 'ABCD'.indexOf(it.answer);
    const keyVal = num(it.choices[keyIdx]);
    if (Number.isFinite(keyVal)) {
      it.choices.forEach((c, i) => {
        const v = num(c);
        if (i !== keyIdx && Number.isFinite(v) && near(v, keyVal)) fail(`${id}: choice ${'ABCD'[i]} duplicates the key value`);
      });
    }
    // all four numeric choices equal each other?
    const vals = it.choices.map(num);
    if (vals.every(Number.isFinite) && new Set(vals.map((v) => v.toFixed(6))).size !== 4) fail(`${id}: numeric choices not distinct`);
  } else {
    if (it.choices) fail(`${id}: spr has choices`);
    if (it.choice_notes) fail(`${id}: spr has choice_notes`);
    if (it.error_tags) fail(`${id}: spr has error_tags`);
    if (!Array.isArray(it.accepted_spr) || !it.accepted_spr.length) fail(`${id}: missing accepted_spr`);
    const v = num(it.answer);
    if (!Number.isFinite(v) && !/^-?\d+\/\d+$/.test(it.answer)) fail(`${id}: spr answer "${it.answer}" not grid-able`);
    for (const a of it.accepted_spr || []) {
      const av = /^-?\d+\/\d+$/.test(a) ? Number(a.split('/')[0]) / Number(a.split('/')[1]) : num(a);
      if (!Number.isFinite(av)) fail(`${id}: accepted_spr "${a}" not numeric`);
    }
  }
}

// ---------- report ----------
const pct = (n) => ((100 * n) / items.length).toFixed(1) + '%';
console.log(`file            ${FILE}`);
console.log(`items           ${items.length}  (need >= 470)`);
console.log(`by domain       ${Object.entries(domains).map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
console.log(`by difficulty   ${DIFF.map((d) => `${d}: ${diffs[d] || 0} (${pct(diffs[d] || 0)})`).join(' | ')}`);
console.log(`by type         ${Object.entries(types).map(([k, v]) => `${k}: ${v} (${pct(v)})`).join(' | ')}`);
console.log(`skills          ${Object.keys(skills).length}`);
console.log(`tables          ${items.reduce((a, i) => a + parseTables(i.stem).length, 0)}`);
console.log('');
if (types.mcq !== (diffs && Object.values(types).reduce((a, b) => a + b, 0) - types.spr)) warn.push('type totals odd');
if (items.length < 470) fail(`only ${items.length} items`);
if ((domains['Problem-Solving and Data Analysis'] || 0) < 250) fail('fewer than 250 data items');
if ((domains['Geometry and Trigonometry'] || 0) < 220) fail('fewer than 220 geometry items');

console.log(`errors          ${errors.length}`);
if (errors.length) {
  const grouped = {};
  for (const e of errors) {
    const k = e.split(':').slice(1).join(':').trim().slice(0, 60);
    grouped[k] = (grouped[k] || 0) + 1;
  }
  console.log('top error kinds:');
  Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${v}x ${k}`));
  console.log('first 20:');
  errors.slice(0, 20).forEach((e) => console.log('  ' + e));
} else {
  console.log('validation      PASS');
}
console.log('');
console.log('per-skill counts:');
Object.entries(skills).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
