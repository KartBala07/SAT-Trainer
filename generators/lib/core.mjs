// Core helpers for the RW Standard English Conventions generator.
// Deterministic only: mulberry32 + FNV-1a string hashing. No Math.random anywhere.

export const STEM =
  'Which choice completes the text so that it conforms to the conventions of Standard English?';
export const DOMAIN = 'Standard English Conventions';
export const SECTION = 'rw';
export const DIFFS = ['easy', 'medium', 'hard', 'very_hard', 'extreme'];
export const TAG_VOCAB = ['misread', 'concept', 'setup', 'quantity', 'none'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(seedStr) {
  const next = mulberry32(fnv1a(seedStr));
  return {
    next,
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Option helper. tag defaults to 'concept' for distractors.
export const o = (text, ok, note, tag) => ({ text, ok, note, tag: tag || 'concept' });

/**
 * Turn a variant spec into a finished item with shuffled choices.
 * spec: { id, skill, rule, difficulty, passage, options[4], expect, skillNote }
 */
export function assemble(spec, key) {
  const opts = spec.options;
  if (!Array.isArray(opts) || opts.length !== 4) {
    throw new Error(`${spec.id}: needs exactly 4 options, got ${opts && opts.length}`);
  }
  const okIdx = opts.findIndex((x) => x.ok);
  const okCount = opts.filter((x) => x.ok).length;
  if (okCount !== 1) throw new Error(`${spec.id}: ${okCount} correct options`);

  // Independent check: exactly one choice must satisfy the stated rule.
  if (spec.expect instanceof RegExp) {
    const pass = opts.filter((x) => spec.expect.test(x.text));
    if (pass.length !== 1) {
      throw new Error(
        `${spec.id}: rule predicate matched ${pass.length} choices -> ${JSON.stringify(
          opts.map((x) => x.text)
        )}`
      );
    }
    if (!spec.expect.test(opts[okIdx].text)) {
      throw new Error(`${spec.id}: keyed option does not satisfy the rule predicate`);
    }
  }

  const rng = makeRng(key);
  const order = rng.shuffle(opts.map((_, i) => i));
  const choices = order.map((i) => opts[i].text);
  const answerPos = order.indexOf(okIdx);
  const answer = 'ABCD'[answerPos];
  const choice_notes = order.map((i) => (opts[i].ok ? 'correct' : opts[i].note));
  const error_tags = order.map((i) => (opts[i].ok ? 'none' : opts[i].tag || 'concept'));

  const wrong = [];
  order.forEach((i, pos) => {
    if (!opts[i].ok) wrong.push({ letter: 'ABCD'[pos], note: opts[i].note });
  });

  const explanation =
    `${spec.rule} ` + wrong.map((w) => `Choice ${w.letter} ${w.note}.`).join(' ');

  return {
    id: spec.id,
    section: SECTION,
    domain: DOMAIN,
    skill: spec.skill,
    rule: spec.rule,
    difficulty: spec.difficulty,
    type: 'mcq',
    passage: spec.passage,
    stem: STEM,
    choices,
    answer,
    choice_notes,
    error_tags,
    explanation,
    skill_note: spec.skillNote,
  };
}

export function signature(item) {
  return item.passage + '||' + item.choices.join('|');
}
