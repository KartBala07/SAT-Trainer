// generators/validate.mjs — independent read-back check of generated/math-data-geo.json
// Reads only the JSON: nothing is trusted from the generator's own verification.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'math-data-geo.json');
const doc = JSON.parse(readFileSync(FILE, 'utf8'));
const items = doc.items;

const DIFF = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
const TAGS = ['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none'];

/* ---------------- check bookkeeping ---------------- */
const CHECKS = [];
function check(name) {
  const c = { name, fails: 0, notes: [], detail: '' };
  CHECKS.push(c);
  return {
    fail(msg) {
      c.fails++;
      if (c.notes.length < 4) c.notes.push(msg);
      return false;
    },
    ok(detail) {
      c.detail = detail == null ? '' : String(detail);
      return true;
    },
    get pass() {
      return c.fails === 0;
    },
  };
}

/* ---------------- helpers ---------------- */
function num(s) {
  const t = String(s).replace(/\$/g, '').replace(/\{,\}/g, '').replace(/,/g, '').replace(/\\%/g, '').trim();
  if (t === '') return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}
const near = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-6 * Math.max(Math.abs(a), Math.abs(b));

function parseTables(stem) {
  const lines = String(stem).split('\n');
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    if (!/^\|?[\s:|-]*-{2,}[\s:|-]*\|?$/.test(lines[i + 1] || '')) continue;
    const rows = [];
    let j = i;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      if (!/^[\s|:|-]*-{2,}[\s|:|-]*$/.test(lines[j].trim())) {
        rows.push(lines[j].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
      }
      j++;
    }
    tables.push(rows);
    i = j - 1;
  }
  return tables;
}

/* ---------------- run every check ---------------- */
const cCount = check('count >= 470');
const cIds = check('ids unique + sequential');
const cDomains = check('domain split (data >= 250, geo >= 220)');
const cDiff = check('difficulty labels + distribution ~25/30/25/15/5');
const cChoices = check('exactly 4 choices per mcq');
const cAnswer = check('answer key is A-D');
const cNotes = check('choice_notes / error_tags length 4, one correct + one none');
const cTags = check('error_tags in vocabulary');
const cDistinct = check('choices distinct (text and numeric value)');
const cTables = check('every table row and column total consistent');
const cDollars = check('balanced $ delimiters');
const cJunk = check('no NaN / undefined / Infinity / null');
const cPunct = check('no stray template artifacts');
const cSpr = check('spr answer + accepted_spr are grid-able numbers');
const cFields = check('all required fields present');
const cProse = check('stem / explanation / skill_note / check non-trivial');

const ids = new Set();
const domains = {};
const diffs = {};
const types = {};
const skills = {};
let tableCount = 0;
let mcqCount = 0;

items.forEach((it, idx) => {
  const id = it.id;

  // ids
  if (!id) cIds.fail(`item ${idx} has no id`);
  else if (ids.has(id)) cIds.fail(`duplicate id ${id}`);
  else ids.add(id);
  if (id !== 'DGGX-' + String(idx + 1).padStart(4, '0')) cIds.fail(`${id} out of sequence at position ${idx + 1}`);

  // fields
  for (const f of ['id', 'section', 'domain', 'skill', 'difficulty', 'type', 'stem', 'explanation', 'desmos', 'skill_note', 'check', 'answer']) {
    if (it[f] == null) cFields.fail(`${id}: missing ${f}`);
    else if (typeof it[f] !== 'string') cFields.fail(`${id}: ${f} not a string`);
  }
  if (it.section !== 'math') cFields.fail(`${id}: section=${it.section}`);
  if (!['Problem-Solving and Data Analysis', 'Geometry and Trigonometry'].includes(it.domain)) cFields.fail(`${id}: bad domain ${it.domain}`);
  if (!DIFF.includes(it.difficulty)) cDiff.fail(`${id}: bad difficulty ${it.difficulty}`);
  if (!['mcq', 'spr'].includes(it.type)) cFields.fail(`${id}: bad type ${it.type}`);
  if (!it.stem || it.stem.length < 18) cProse.fail(`${id}: stem too short`);
  if (!it.explanation || it.explanation.length < 60) cProse.fail(`${id}: explanation too short`);
  if (!it.skill_note || it.skill_note.length < 12) cProse.fail(`${id}: skill_note too short`);
  if (!it.check || it.check.length < 10) cProse.fail(`${id}: check too short`);

  domains[it.domain] = (domains[it.domain] || 0) + 1;
  diffs[it.difficulty] = (diffs[it.difficulty] || 0) + 1;
  types[it.type] = (types[it.type] || 0) + 1;
  skills[it.skill] = (skills[it.skill] || 0) + 1;

  // math delimiters (escaped \$ used for money is not a delimiter)
  const bare = it.stem.replace(/\\\$/g, '');
  if ((bare.match(/\$/g) || []).length % 2 !== 0) cDollars.fail(`${id}: odd number of $ in stem`);
  if (/\$\s*\$/.test(it.stem)) cDollars.fail(`${id}: empty math span`);
  if (/\\\$\\\$/.test(it.stem)) cDollars.fail(`${id}: doubled money delimiter`);
  for (const c of it.choices || []) {
    const b = String(c).replace(/\\\$/g, '');
    if ((b.match(/\$/g) || []).length % 2 !== 0) cDollars.fail(`${id}: odd $ in choice ${c}`);
    if (/\\[a-zA-Z]/.test(String(c)) && !String(c).includes('$')) cDollars.fail(`${id}: bare LaTeX choice ${c}`);
  }

  // junk
  const js = JSON.stringify(it);
  if (/\bNaN\b|\bundefined\b|\bInfinity\b|\bnull\b/.test(js)) cJunk.fail(`${id}: NaN/undefined/Infinity/null`);
  if (it.stem.includes('${') || /\s{3,}/.test(it.stem)) cPunct.fail(`${id}: template artifact or run of spaces`);

  // tables
  const tables = parseTables(it.stem);
  tableCount += tables.length;
  for (const rows of tables) {
    let sub = it.type === 'spr' ? it.answer : it.choices['ABCD'.indexOf(it.answer)];
    const body = rows.map((r) => r.map((c) => (c === '?' ? sub : c)));
    if (body.length < 3) {
      cTables.fail(`${id}: table has fewer than 2 data rows`);
      continue;
    }
    const head = body[0];
    const data = body.slice(1);
    if (data[data.length - 1][0] !== 'Total') cTables.fail(`${id}: table has no Total row`);
    for (let r = 0; r < data.length - 1; r++) {
      const row = data[r];
      const total = num(row[row.length - 1]);
      const parts = row.slice(1, -1).map(num);
      if (!Number.isFinite(total)) cTables.fail(`${id}: row "${row[0]}" total not numeric`);
      else if (parts.every(Number.isFinite) && !near(parts.reduce((a, b) => a + b, 0), total)) {
        cTables.fail(`${id}: row "${row[0]}" sums to ${parts.reduce((a, b) => a + b, 0)} but total is ${total}`);
      }
    }
    for (let c = 1; c < head.length; c++) {
      const total = num(data[data.length - 1][c]);
      const parts = data.slice(0, -1).map((r) => num(r[c]));
      if (!Number.isFinite(total)) cTables.fail(`${id}: column "${head[c]}" total not numeric`);
      else if (parts.every(Number.isFinite) && !near(parts.reduce((a, b) => a + b, 0), total)) {
        cTables.fail(`${id}: column "${head[c]}" sums to ${parts.reduce((a, b) => a + b, 0)} but total is ${total}`);
      }
    }
  }

  if (it.type === 'mcq') {
    mcqCount++;
    if (!Array.isArray(it.choices) || it.choices.length !== 4) {
      cChoices.fail(`${id}: ${it.choices ? it.choices.length : 0} choices`);
      return;
    }
    if (new Set(it.choices).size !== 4) cDistinct.fail(`${id}: duplicate choice text`);
    if (!/^[ABCD]$/.test(it.answer)) cAnswer.fail(`${id}: answer ${it.answer}`);
    if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) cNotes.fail(`${id}: choice_notes length ${it.choice_notes && it.choice_notes.length}`);
    else if (it.choice_notes.filter((n) => n === 'correct').length !== 1) cNotes.fail(`${id}: ${it.choice_notes.filter((n) => n === 'correct').length} notes say correct`);
    else if (it.choice_notes.some((n) => !n || n.length < 4)) cNotes.fail(`${id}: empty choice note`);
    if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) cNotes.fail(`${id}: error_tags length ${it.error_tags && it.error_tags.length}`);
    else {
      if (it.error_tags.filter((t) => t === 'none').length !== 1) cNotes.fail(`${id}: ${it.error_tags.filter((t) => t === 'none').length} 'none' tags`);
      for (const t of it.error_tags) if (!TAGS.includes(t)) cTags.fail(`${id}: bad tag ${t}`);
    }
    if (it.accepted_spr) cFields.fail(`${id}: mcq carries accepted_spr`);
    const keyIdx = 'ABCD'.indexOf(it.answer);
    const keyVal = num(it.choices[keyIdx]);
    const vals = it.choices.map(num);
    if (Number.isFinite(keyVal)) {
      it.choices.forEach((c, i) => {
        const v = num(c);
        if (i !== keyIdx && Number.isFinite(v) && near(v, keyVal)) cDistinct.fail(`${id}: choice ${'ABCD'[i]} equals the key value`);
      });
      if (vals.every(Number.isFinite) && new Set(vals.map((v) => v.toFixed(6))).size !== 4) cDistinct.fail(`${id}: numeric choices not distinct`);
    }
  } else {
    if (it.choices) cFields.fail(`${id}: spr carries choices`);
    if (it.choice_notes || it.error_tags) cFields.fail(`${id}: spr carries note/tag arrays`);
    if (!Array.isArray(it.accepted_spr) || !it.accepted_spr.length) cSpr.fail(`${id}: accepted_spr missing`);
    const isFrac = (s) => /^-?\d+\/\d+$/.test(s);
    const v = isFrac(it.answer) ? Number(it.answer.split('/')[0]) / Number(it.answer.split('/')[1]) : num(it.answer);
    if (!Number.isFinite(v)) cSpr.fail(`${id}: answer "${it.answer}" not grid-able`);
    for (const a of it.accepted_spr || []) {
      const av = isFrac(a) ? Number(a.split('/')[0]) / Number(a.split('/')[1]) : num(a);
      if (!Number.isFinite(av)) cSpr.fail(`${id}: accepted_spr "${a}" not numeric`);
      else if (Number.isFinite(v) && !near(av, v)) cSpr.fail(`${id}: accepted_spr "${a}" differs from answer`);
    }
  }
});

if (items.length < 470) cCount.fail(`only ${items.length} items`);
const nData = domains['Problem-Solving and Data Analysis'] || 0;
const nGeo = domains['Geometry and Trigonometry'] || 0;
if (nData < 250) cDomains.fail(`only ${nData} data items`);
if (nGeo < 220) cDomains.fail(`only ${nGeo} geometry items`);
const share = (d) => (100 * (diffs[d] || 0)) / items.length;
if (Math.abs(share('easy') - 25) > 5) cDiff.fail(`easy ${share('easy').toFixed(1)}%`);
if (Math.abs(share('medium') - 30) > 5) cDiff.fail(`medium ${share('medium').toFixed(1)}%`);
if (Math.abs(share('hard') - 25) > 5) cDiff.fail(`hard ${share('hard').toFixed(1)}%`);
if (Math.abs(share('very_hard') - 15) > 4) cDiff.fail(`very_hard ${share('very_hard').toFixed(1)}%`);
if (Math.abs(share('extreme') - 5) > 2.5) cDiff.fail(`extreme ${share('extreme').toFixed(1)}%`);

/* ---------------- report ---------------- */
const pct = (n) => ((100 * n) / items.length).toFixed(1) + '%';
console.log(`file            ${FILE}`);
console.log(`items           ${items.length}`);
console.log(`by domain       ${Object.entries(domains).map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
console.log(`by difficulty   ${DIFF.map((d) => `${d} ${diffs[d] || 0} (${pct(diffs[d] || 0)})`).join(' | ')}`);
console.log(`by type         ${Object.entries(types).map(([k, v]) => `${k}: ${v} (${pct(v)})`).join(' | ')}`);
console.log(`skills          ${Object.keys(skills).length}   tables ${tableCount}   mcq ${mcqCount}   spr ${types.spr || 0}`);
console.log('');
const width = Math.max(...CHECKS.map((c) => c.name.length));
let failed = 0;
for (const c of CHECKS) {
  const pass = c.fails === 0;
  if (!pass) failed++;
  const detail = c.detail ? `  ${c.detail}` : '';
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(width)}${c.fails ? `  ${c.fails} failure(s)` : ''}${detail}`);
  for (const n of c.notes) console.log(`          ${n}`);
}
console.log('');
console.log(failed === 0 ? `validation      PASS (${CHECKS.length}/${CHECKS.length} checks)` : `validation      FAIL (${failed} of ${CHECKS.length} checks)`);
console.log('');
console.log('per-skill counts:');
Object.entries(skills).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
