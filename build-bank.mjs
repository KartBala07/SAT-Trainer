#!/usr/bin/env node
// Materialise the question bank for the static site.
//   node build-bank.mjs
// Reads question-packs/*.json (hand-authored) + generated/*.json (parametric),
// normalises, de-duplicates, validates, and writes:
//   public/data/manifest.json   counts for instant UI
//   public/data/math.json       { items: [...] }
//   public/data/rw.json         { items: [...] }

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PACKS = join(ROOT, 'question-packs');
const GEN = join(ROOT, 'generated');
const OUT = join(ROOT, 'data');

const DOMAINS = {
  math: ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'],
  rw: ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'],
};
const DIFFS = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
const TAGS = new Set(['misread', 'sign', 'algebra', 'concept', 'setup', 'unit', 'quantity', 'arithmetic', 'none']);

const problems = [];
const warn = (m) => problems.push(m);

// Generators emit things like "x^2-1x+-5" or "1x". Normalise the surface form
// without touching real coefficients.
function tidy(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\+-/g, '-')
    .replace(/-\+/g, '-')
    .replace(/(?<![\d.])1([a-z])\b/g, '$1');
}

// A "$" in LaTeX may be an escaped money sign (\$) and must not count toward
// delimiter balance.
function mathDelimsBalanced(s) {
  if (typeof s !== 'string') return true;
  const masked = s.replace(/\\\$/g, '');
  return (masked.match(/\$/g) || []).length % 2 === 0;
}

function usable(q) {
  if (!q.id || !q.stem) return false;
  if (q.type === 'mcq') {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
    if (q.choices.some((c) => c == null || String(c).trim() === '')) return false;
    return 'ABCD'.includes(q.answer) && q.answer.length === 1;
  }
  return q.answer != null && String(q.answer).trim() !== '';
}

async function readDir(dir) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

function normDomain(section, raw) {
  const list = DOMAINS[section];
  if (!raw) return list[0];
  if (list.includes(raw)) return raw;
  const low = String(raw).toLowerCase();
  const hits = list.filter((d) => d.toLowerCase() === low || low.includes(d.toLowerCase().split(' ')[0]));
  return hits[0] || list[0];
}

function validate(q, where) {
  const tag = `${where}/${q.id || '?'}`;
  if (!q.id) return warn(`${tag}: missing id`);
  if (!q.stem) return warn(`${tag}: missing stem`);
  if (!q.explanation) warn(`${tag}: missing explanation`);
  if (!DIFFS.includes(q.difficulty)) q.difficulty = 'medium';
  if (q.type !== 'mcq' && q.type !== 'spr') q.type = 'mcq';
  if (q.type === 'mcq') {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return warn(`${tag}: choices != 4`);
    if (!'ABCD'.includes(q.answer) || q.answer.length !== 1) return warn(`${tag}: answer invalid ${q.answer}`);
    if (q.choices.some((c) => c == null || String(c).trim() === '')) warn(`${tag}: empty choice`);
    const norm = q.choices.map((c) => String(c).replace(/\s+/g, ' ').trim().toLowerCase());
    if (new Set(norm).size !== 4) warn(`${tag}: duplicate choices`);
    if (!Array.isArray(q.choice_notes) || q.choice_notes.length !== 4) {
      q.choice_notes = ['correct', '', '', ''];
      q.choice_notes['ABCD'.indexOf(q.answer)] = 'correct';
      warn(`${tag}: choice_notes repaired`);
    }
    if (!Array.isArray(q.error_tags) || q.error_tags.length !== 4) {
      q.error_tags = ['none', 'concept', 'setup', 'quantity'];
      q.error_tags['ABCD'.indexOf(q.answer)] = 'none';
      warn(`${tag}: error_tags repaired`);
    }
    q.error_tags = q.error_tags.map((t) => (TAGS.has(t) ? t : 'concept'));
    q.error_tags['ABCD'.indexOf(q.answer)] = 'none';
    q.choice_notes['ABCD'.indexOf(q.answer)] = 'correct';
  } else {
    delete q.choices;
    if (q.answer == null || q.answer === '') return warn(`${tag}: spr without answer`);
    q.answer = String(q.answer);
    if (!Array.isArray(q.accepted_spr) || !q.accepted_spr.length) q.accepted_spr = [q.answer];
  }
  for (const f of ['stem', 'explanation', 'passage', 'passage2']) {
    const s = q[f];
    if (typeof s !== 'string') continue;
    if (!mathDelimsBalanced(s)) warn(`${tag}: odd $ count in ${f}`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) warn(`${tag}: control char in ${f}`);
    if (/[\uE000-\uF8FF]/.test(s)) warn(`${tag}: private-use char in ${f}`);
  }
  return null;
}

const items = [];
const seenStem = new Map();

async function ingest(file, dir, defaultSection) {
  const raw = await readFile(join(dir, file), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    problems.push(`${file}: JSON PARSE FAIL — ${e.message}`);
    return 0;
  }
  const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.questions || [];
  let n = 0;
  for (const q of list) {
    const section = q.section || defaultSection;
    if (!DOMAINS[section]) {
      problems.push(`${q.id}: unknown section ${section}`);
      continue;
    }
    q.section = section;
    q.domain = normDomain(section, q.domain);
    q.stem = tidy(q.stem);
    q.explanation = tidy(q.explanation);
    if (Array.isArray(q.choices)) q.choices = q.choices.map(tidy);
    q.passage = tidy(q.passage);
    q.passage2 = tidy(q.passage2);
    // some generators put the grid-in key only in accepted_spr
    if (q.type === 'spr' && (q.answer == null || q.answer === '') && Array.isArray(q.accepted_spr) && q.accepted_spr.length) {
      q.answer = String(q.accepted_spr[0]);
    }
    validate(q, file);
    delete q.check;
    if (!usable(q)) {
      problems.push(`${q.id}: DROPPED — unusable (${q.type}, answer=${JSON.stringify(q.answer)})`);
      continue;
    }
    if (!q.id) continue;
    // de-duplicate on the text of the question itself
    const key = createHash('sha1')
      .update(section + '|' + String(q.passage || '').trim() + '|' + String(q.stem).trim())
      .digest('hex');
    if (seenStem.has(key)) {
      problems.push(`${q.id}: duplicate content of ${seenStem.get(key)}`);
      continue;
    }
    seenStem.set(key, q.id);
    items.push(q);
    n++;
  }
  return n;
}

const stats = {};
for (const f of await readDir(PACKS)) stats[f] = await ingest(f, PACKS, 'math');
for (const f of await readDir(GEN)) stats[f] = await ingest(f, GEN, f.startsWith('rw') ? 'rw' : 'math');

// stable order: section, domain, difficulty, id
const dIdx = (d) => DIFFS.indexOf(d);
items.sort(
  (a, b) =>
    a.section.localeCompare(b.section) ||
    a.domain.localeCompare(b.domain) ||
    dIdx(a.difficulty) - dIdx(b.difficulty) ||
    a.id.localeCompare(b.id)
);

const bySection = { math: [], rw: [] };
for (const q of items) bySection[q.section].push(q);

const manifest = { builtAt: new Date().toISOString(), total: items.length, sections: {} };
for (const key of ['math', 'rw']) {
  const list = bySection[key];
  const byDomain = {};
  const byDiff = {};
  const bySkill = {};
  for (const q of list) {
    byDomain[q.domain] = (byDomain[q.domain] || 0) + 1;
    byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    bySkill[q.skill || 'other'] = (bySkill[q.skill || 'other'] || 0) + 1;
  }
  manifest.sections[key] = { count: list.length, byDomain, byDiff, skills: Object.keys(bySkill).length };
}

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'math.json'), JSON.stringify({ items: bySection.math }));
await writeFile(join(OUT, 'rw.json'), JSON.stringify({ items: bySection.rw }));
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));

console.log('\n  sources');
for (const [f, n] of Object.entries(stats)) console.log(`    ${f.padEnd(46)} ${String(n).padStart(5)}`);
console.log(`\n  bank total: ${items.length}`);
for (const key of ['math', 'rw']) {
  const s = manifest.sections[key];
  console.log(`\n  ${key.toUpperCase()}: ${s.count} items · ${s.skills} skills`);
  console.log(`    difficulty ${JSON.stringify(s.byDiff)}`);
  for (const [d, n] of Object.entries(s.byDomain)) console.log(`    ${d.padEnd(38)} ${n}`);
}
const hardIssues = problems.filter((p) => /PARSE|duplicate content|choices != 4|answer invalid|unknown section/.test(p));
console.log(`\n  issues: ${problems.length} (${hardIssues.length} serious)`);
for (const p of problems.slice(0, 40)) console.log('    •', p);
if (problems.length > 40) console.log(`    … ${problems.length - 40} more`);
console.log('');
