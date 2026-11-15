#!/usr/bin/env node
// Digital SAT Reading & Writing — Standard English Conventions item generator.
// Deterministic: every item is assembled with a mulberry32 stream seeded from
// its own frame id and passage text. No Math.random anywhere.
//
//   node generators/rw-conventions.mjs
//     -> generated/rw-conventions.json  { "items": [...] , "meta": {...} }

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundaryFrames1 } from './frames/boundaries-1.mjs';
import { boundaryFrames2 } from './frames/boundaries-2.mjs';
import { formFrames1 } from './frames/form-1.mjs';
import { formFrames2 } from './frames/form-2.mjs';
import { LEADS } from './frames/leads.mjs';
import { assemble, signature, words, o, DIFFS, TAG_VOCAB, STEM, DOMAIN } from './lib/core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// ---------------------------------------------------------------- candidates

function normalizeBoundary(list) {
  return list.map((v) => ({ ...v }));
}

function normalizeForm(frame) {
  const out = [];
  frame.items.forEach((it, i) => {
    const esc = it.ok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = LEADS[`${frame.id}#${i}`];
    if (!lead) throw new Error(`missing lead for ${frame.id}#${i}`);
    out.push({
      frame: frame.id,
      skill: frame.skill,
      rule: frame.rule || frame.rules,
      difficulty: frame.diff,
      passage: `${lead} ${it.p}`,
      options: [
        o(it.ok, true, 'correct'),
        o(it.w[0], false, frame.notes[0]),
        o(it.w[1], false, frame.notes[1]),
        o(it.w[2], false, frame.notes[2]),
      ],
      expect: new RegExp(`^${esc}$`),
      skillNote: frame.note,
    });
  });
  return out;
}

const RULES = {
  'Form: subject-verb agreement with intervening phrases':
    'A verb agrees with its subject, not with a noun in an intervening phrase such as "along with", "together with", or "as well as".',
  'Form: inverted subject-verb agreement':
    'When a sentence opens with "there" or with a fronted prepositional phrase, the verb still agrees with the noun that follows it.',
  'Form: collective nouns':
    'A collective noun such as jury, committee, or flock takes a singular verb when the group acts as a single unit.',
  'Form: indefinite pronouns':
    'Each, every, either, neither, and one are singular and take singular verbs, even when a plural phrase follows them.',
  'Form: pronoun-antecedent agreement':
    'A pronoun must agree in number with its antecedent; a collective or singular antecedent takes a singular pronoun.',
  'Form: pronoun case':
    "A pronoun in a compound object takes the object form, and who or whom is chosen by the pronoun's role in its own clause.",
  'Form: one of the ... agreement':
    'In "one of the plural noun who/that ...", the relative pronoun refers to the plural noun, so the verb in the relative clause is plural.',
  'Form: verb tense consistency':
    'Verbs in a sentence, or in a closely linked pair of sentences, keep a consistent tense unless the meaning requires a shift.',
  'Form: perfect tenses':
    'The perfect tenses place an action before a stated time: had for a point in the past, has for the present, will have for a point in the future.',
  'Form: subjunctive mood':
    'A contrary-to-fact condition takes "were", and a demand or request after "that" takes the base form of the verb.',
  'Form: parallelism in a series':
    'Items joined in a series must share the same grammatical form, whether they are verbs, nouns, or whole clauses.',
  'Form: parallel correlatives':
    'Correlative conjunctions such as not only ... but also and neither ... nor must join parallel grammatical structures.',
  'Form: dangling and misplaced modifiers':
    'An introductory modifier must describe the subject of the main clause that follows it, and a modifier must sit next to the word it modifies.',
  'Form: comparisons with as ... as':
    'An equal comparison is built with as ... as; "than" belongs to a comparison of inequality.',
  'Form: fewer and less':
    'Fewer counts individual items; less measures an amount that cannot be counted.',
};

function normalizeFormAll(frames) {
  return frames.flatMap((frame) => normalizeForm({ ...frame, rule: RULES[frame.skill] }));
}

const raw = [
  ...normalizeBoundary(boundaryFrames1),
  ...normalizeBoundary(boundaryFrames2),
  ...normalizeFormAll(formFrames1),
  ...normalizeFormAll(formFrames2),
];

// Drop anything whose rule predicate does not isolate exactly one choice, and
// anything whose four choices are not distinct. assemble() enforces the rest.
const candidates = [];
const seenSig = new Set();
let droppedDup = 0;
for (const spec of raw) {
  if (!spec.rule) throw new Error(`${spec.frame}: missing rule`);
  const texts = spec.options.map((x) => x.text);
  if (new Set(texts).size !== 4) throw new Error(`${spec.frame}: duplicate choice text`);
  const item = assemble(spec, `${spec.frame}::${spec.passage}`);
  const sig = signature(item);
  if (seenSig.has(sig)) {
    droppedDup++;
    continue;
  }
  seenSig.add(sig);
  candidates.push({ item, spec });
}

// ---------------------------------------------------------------- selection

// 30 / 35 / 20 / 10 / 5 of 460
const TARGET_TOTAL = 460;
const TARGET = {
  easy: Math.round(TARGET_TOTAL * 0.3),
  medium: Math.round(TARGET_TOTAL * 0.35),
  hard: Math.round(TARGET_TOTAL * 0.2),
  very_hard: Math.round(TARGET_TOTAL * 0.1),
  extreme: Math.round(TARGET_TOTAL * 0.05),
};

const skillOrder = [];
const pool = new Map(); // skill -> tier -> []
for (const c of candidates) {
  const s = c.item.skill;
  if (!pool.has(s)) {
    pool.set(s, { easy: [], medium: [], hard: [], very_hard: [], extreme: [] });
    skillOrder.push(s);
  }
  pool.get(s)[c.item.difficulty].push(c);
}

const selected = [];
const count = { easy: 0, medium: 0, hard: 0, very_hard: 0, extreme: 0 };
const shortages = {};
for (const tier of DIFFS) {
  let progress = true;
  while (count[tier] < TARGET[tier] && progress) {
    progress = false;
    for (const s of skillOrder) {
      if (count[tier] >= TARGET[tier]) break;
      const list = pool.get(s)[tier];
      if (list.length) {
        selected.push(list.shift());
        count[tier]++;
        progress = true;
      }
    }
  }
  if (count[tier] < TARGET[tier]) shortages[tier] = TARGET[tier] - count[tier];
}

// ---------------------------------------------------------------- ordering + ids

const diffRank = Object.fromEntries(DIFFS.map((d, i) => [d, i]));
selected.sort((a, b) => {
  const sa = skillOrder.indexOf(a.item.skill);
  const sb = skillOrder.indexOf(b.item.skill);
  if (sa !== sb) return sa - sb;
  const da = diffRank[a.item.difficulty];
  const db = diffRank[b.item.difficulty];
  if (da !== db) return da - db;
  return a.item.passage < b.item.passage ? -1 : a.item.passage > b.item.passage ? 1 : 0;
});

const items = selected.map((c, i) => ({ ...c.item, id: `RWC-${String(i + 1).padStart(4, '0')}` }));

// ---------------------------------------------------------------- validation

function validate(list) {
  const errors = [];
  const ids = new Set();
  const sigs = new Set();
  const bySkill = {};
  const byDiff = Object.fromEntries(DIFFS.map((d) => [d, 0]));
  let minWords = 1e9;
  let maxWords = 0;

  for (const it of list) {
    if (ids.has(it.id)) errors.push(`duplicate id ${it.id}`);
    ids.add(it.id);
    const sig = signature(it);
    if (sigs.has(sig)) errors.push(`duplicate passage+choices ${it.id}`);
    sigs.add(sig);

    if (it.section !== 'rw') errors.push(`${it.id}: section`);
    if (it.domain !== DOMAIN) errors.push(`${it.id}: domain`);
    if (it.type !== 'mcq') errors.push(`${it.id}: type`);
    if (it.stem !== STEM) errors.push(`${it.id}: stem`);
    if (!Array.isArray(it.choices) || it.choices.length !== 4) errors.push(`${it.id}: choices`);
    if (!/^[A-D]$/.test(it.answer)) errors.push(`${it.id}: answer letter`);
    if (!Array.isArray(it.choice_notes) || it.choice_notes.length !== 4) errors.push(`${it.id}: notes length`);
    if (!Array.isArray(it.error_tags) || it.error_tags.length !== 4) errors.push(`${it.id}: tags length`);

    const key = 'ABCD'.indexOf(it.answer);
    if (it.choice_notes[key] !== 'correct') errors.push(`${it.id}: 'correct' not at key`);
    if (it.choice_notes.filter((n) => n === 'correct').length !== 1) errors.push(`${it.id}: multiple 'correct' notes`);
    if (it.error_tags[key] !== 'none') errors.push(`${it.id}: 'none' not at key`);
    for (const t of it.error_tags) if (!TAG_VOCAB.includes(t)) errors.push(`${it.id}: bad tag ${t}`);
    if (it.error_tags.filter((t) => t === 'none').length !== 1) errors.push(`${it.id}: multiple 'none' tags`);

    if (!it.passage.includes('______')) errors.push(`${it.id}: no blank`);
    const w = words(it.passage.replace('______', it.choices[key]));
    if (w < 20 || w > 60) errors.push(`${it.id}: passage ${w} words`);
    minWords = Math.min(minWords, w);
    maxWords = Math.max(maxWords, w);

    if (!it.explanation || it.explanation.length < 40) errors.push(`${it.id}: explanation too short`);
    for (const L of 'ABCD') {
      if (L !== it.answer && !it.explanation.includes(`Choice ${L}`)) {
        errors.push(`${it.id}: explanation omits choice ${L}`);
      }
    }
    if (!it.skill_note) errors.push(`${it.id}: skill_note`);
    if (!it.rule) errors.push(`${it.id}: rule`);

    bySkill[it.skill] = (bySkill[it.skill] || 0) + 1;
    byDiff[it.difficulty] = (byDiff[it.difficulty] || 0) + 1;
  }

  return { errors, bySkill, byDiff, minWords, maxWords, uniqueIds: ids.size, uniqueSigs: sigs.size };
}

const report = validate(items);

// ---------------------------------------------------------------- output

export function generate() {
  return items;
}

export function generateBundle() {
  // Shape matches the other packs in generated/: { "items": [...] }
  return { items };
}

export const stats = {
  candidates: candidates.length,
  droppedDup,
  selected: items.length,
  shortages,
  byDiff: report.byDiff,
  bySkill: report.bySkill,
  minWords: report.minWords,
  maxWords: report.maxWords,
  errors: report.errors,
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const outDir = join(ROOT, 'generated');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'rw-conventions.json');
  const bundle = generateBundle();
  const json = JSON.stringify(bundle, null, 2);
  JSON.parse(json); // hygiene gate
  writeFileSync(outPath, json + '\n', 'utf8');

  const pct = (n) => ((100 * n) / items.length).toFixed(1) + '%';
  console.log(`wrote ${outPath}`);
  console.log(`candidates: ${candidates.length} (dropped duplicates: ${droppedDup})`);
  console.log(`items: ${items.length}`);
  console.log(
    `difficulty: ` +
      DIFFS.map((d) => `${d} ${report.byDiff[d]} (${pct(report.byDiff[d])})`).join(', ')
  );
  console.log(`shortages: ${JSON.stringify(shortages)}`);
  console.log(`passage words: ${report.minWords}-${report.maxWords}`);
  console.log(`skills: ${Object.keys(report.bySkill).length}`);
  for (const [s, n] of Object.entries(report.bySkill)) console.log(`  ${String(n).padStart(3)}  ${s}`);
  console.log(`unique ids: ${report.uniqueIds}, unique passage+choices: ${report.uniqueSigs}`);
  if (report.errors.length) {
    console.log(`VALIDATION ERRORS (${report.errors.length}):`);
    for (const e of report.errors.slice(0, 40)) console.log('  ! ' + e);
    process.exitCode = 1;
  } else {
    console.log('validation: OK');
  }
}
