// Digital SAT Reading & Writing generator: Words in Context, Transitions,
// Command of Evidence. Deterministic (mulberry32 only) and dependency-free.
//
//   node generators/rw-words-transitions.mjs
//   -> generated/rw-words-transitions.json   {"items":[...]}

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { finalize, validate, report, SEED, renderTable } from './rw-lib.mjs';
import { WIC_ALL, TRANS_ALL, COE_ALL } from './rw-data/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'generated', 'rw-words-transitions.json');

// Command of Evidence sits under "Information and Ideas" on the real Digital
// SAT. If a downstream schema only allows the other two R&W domains, point
// this at 'Expression of Ideas'.
const COE_DOMAIN = 'Information and Ideas';

const WIC_NOTE = [
  'another common sense of the word',
  'a related but wrong sense',
  'a sense this passage rules out',
];
const WIC_TAG = ['misread', 'misread', 'concept'];

function wicDrafts(rows) {
  return rows.map(([w, passage, key, otherSenses, explanation, lvl]) => {
    // The stem must name the word exactly as the passage prints it ("credited",
    // not "credit"), so the bracketed form wins over the dictionary lemma.
    const m = passage.match(/\[([^\]]+)\]/);
    const surface = m ? m[1] : w;
    return {
      skill: 'Words in context',
      domain: 'Craft and Structure',
      passage,
      stem: `As used in the text, what does the word "${surface}" most nearly mean?`,
      correct: key,
      wrongs: otherSenses.map((t, i) => ({ text: t, note: WIC_NOTE[i], tag: WIC_TAG[i] })),
      explanation,
      skill_note: `The trap is "${otherSenses[0]}": a real sense of "${w}", but nothing in this passage supports it.`,
      lvl,
    };
  });
}

// ---- transitions ---------------------------------------------------------
// spec: { p: passage with ______, k: keyed transition, w: [3 wrong transitions],
//         e: explanation, n: skill note, lvl, why: short label for the keyed move }
function transDrafts(specs) {
  return specs.map((s) => ({
    skill: 'Transitions',
    domain: 'Expression of Ideas',
    passage: s.p,
    stem: 'Which choice completes the text with the most logical transition?',
    correct: s.k,
    wrongs: s.w.map((t) => ({ text: t, note: `wrong relationship: ${t}`, tag: 'misread' })),
    explanation: s.e,
    skill_note: s.n,
    lvl: s.lvl,
  }));
}

// ---- command of evidence -------------------------------------------------
// spec: { pass, s, k, w:[3], e, n, lvl, table? }
// Table specs carry {l0}{v0}{l1}{v1}{d}{u} placeholders that are filled from
// the table rows themselves, so a keyed choice can never cite a number the
// table does not contain.
function unitSuffix(unit) {
  if (!unit) return '';
  return unit === '%' ? '%' : ' ' + unit;
}

function fillTemplate(str, table) {
  if (!table) return str;
  const rows = table.rows;
  const vals = rows.map((r) => Number(r[1]));
  const map = { u: unitSuffix(table.unit) };
  rows.forEach((r, i) => {
    map['l' + i] = r[0];
    map['v' + i] = String(vals[i]);
  });
  if (vals.length >= 2) map.d = String(+(Math.abs(vals[1] - vals[0]).toFixed(2)));
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

function coeDrafts(specs) {
  return specs.map((s) => {
    let stem = s.s;
    if (s.table) {
      const t = renderTable(s.table.c0, s.table.c1, s.table.rows, s.table.unit);
      stem = `${s.table.lead}\n\n${t}\n\n${s.s}`;
    }
    return {
      skill: 'Command of Evidence',
      domain: COE_DOMAIN,
      passage: s.p,
      stem,
      correct: fillTemplate(s.k, s.table),
      wrongs: s.w.map((t, i) => ({
        text: fillTemplate(t, s.table),
        note: i === 0 ? 'addresses a different comparison' : i === 1 ? 'relevant topic, wrong variable' : 'no bearing on the claim',
        tag: i === 0 ? 'concept' : i === 1 ? 'misread' : 'concept',
      })),
      explanation: s.e,
      skill_note: s.n,
      lvl: s.lvl,
    };
  });
}

export function generate() {
  const drafts = [
    ...wicDrafts(WIC_ALL),
    ...transDrafts(TRANS_ALL),
    ...coeDrafts(COE_ALL),
  ];
  const items = finalize(drafts, { seed: SEED });
  return { items };
}

export function main() {
  const bank = generate();
  const v = validate(bank.items, { min: 330 });
  console.log(report(bank.items, v));
  if (v.errors.length) {
    console.error('Refusing to write an invalid bank.');
    process.exitCode = 1;
    return v;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(bank, null, 2) + '\n');
  const kb = Math.round(statSync(OUT).size / 1024);
  console.log(`wrote ${OUT} (${kb} KB)`);
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { OUT, renderTable };
