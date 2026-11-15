// Verifies Coach.topicOf against every skill string in the shipped bank.
// Usage: node tools/check-topics.mjs
global.window = global;
await import('../js/coach.js');
import { readFile } from 'node:fs/promises';

const { topicOf } = global.Coach;
const load = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const math = await load('../data/math.json');
const rw = await load('../data/rw.json');

const items = math.items || math.questions || math;
const itemsRw = rw.items || rw.questions || rw;
const all = [...items, ...itemsRw].map((q) => ({ skill: q.skill || q.skill_note || '', domain: q.domain, section: q.section }));

const counts = new Map();
const bySkill = new Map();
for (const it of all) {
  const topic = topicOf(it.skill, it.domain);
  counts.set(topic, (counts.get(topic) || 0) + 1);
  if (!bySkill.has(topic)) bySkill.set(topic, new Set());
  bySkill.get(topic).add(`${it.domain || it.section} :: ${it.skill}`);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`=== ${all.length} questions -> ${sorted.length} topics\n`);
for (const [topic, n] of sorted) console.log(String(n).padStart(5), topic);

// a topic that swallows many different domains is almost certainly a bad regex
console.log('\n=== suspicious topics (mix of unrelated domains under one topic)');
let bad = 0;
for (const [topic, set] of bySkill) {
  const domains = new Set([...set].map((s) => s.split(' :: ')[0]));
  if (domains.size > 1) {
    bad++;
    console.log(`\n[${topic}] spans ${domains.size} domains:`, [...domains].join(', '));
    for (const s of [...set].slice(0, 6)) console.log('   ', s);
  }
}
if (!bad) console.log('none');
console.log(`\n=== ${new Set([...bySkill.values()].flatMap((s) => [...s])).size} distinct skill strings mapped`);
