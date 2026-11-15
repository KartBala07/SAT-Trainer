// Boundary items, part 2: apostrophes, contractions, homophones, quotation
// marks, and hyphens versus dashes.
import { o } from '../lib/core.mjs';

const SK = {
  SING: 'Boundaries: singular possession',
  PLUR: 'Boundaries: plural possession',
  NAME: 'Boundaries: names ending in s',
  CONTR: 'Boundaries: contractions',
  ITS: "Boundaries: its and it's",
  WHOSE: "Boundaries: whose and who's",
  QUOTE: 'Boundaries: quotation marks',
  HYPH: 'Boundaries: hyphens and dashes',
};

const RULE = {
  SING: 'A singular possessive noun takes an apostrophe before the s; without the apostrophe the word is merely plural, and a plural possessive would put the apostrophe after the s.',
  PLUR: 'A plural possessive puts the apostrophe after the plural s; a plural that does not end in s takes an apostrophe and then s.',
  NAME: 'A singular name that ends in s still takes an apostrophe and an s to show possession in edited American prose.',
  CONTR: 'A contraction marks the missing letters with an apostrophe placed exactly where the letters were dropped; misspelling or omitting the apostrophe turns the word into something else.',
  ITS: "Its is the possessive form and takes no apostrophe; it's is always the contraction of it is or it has.",
  WHOSE: "Whose is the possessive form; who's is always the contraction of who is or who has.",
  QUOTE: 'In American style a period or comma closing a quotation goes inside the closing quotation mark, and both marks are required.',
  HYPH: 'A compound modifier before a noun is hyphenated with a single short hyphen; an em dash or en dash is not a hyphen, and an -ly adverb is never hyphenated to the word it modifies.',
};

const out = [];

function add(frame, skill, rule, diff, passage, options, expect, skillNote) {
  out.push({ frame, skill, rule, difficulty: diff, passage, options, expect, skillNote });
}

/* ---------------- singular possession ---------------- */

const sing = [
  {
    id: 'SIN-1',
    diff: 'easy',
    pres: [
      'Copper sheathing was standard practice at every yard by 1800, especially on naval vessels.',
      'The yard kept detailed records of every refit it carried out, down to the last bolt.',
      'Salt water destroys unprotected iron fittings within a single season, even in a sheltered harbor.',
    ],
    items: [
      ['ship', 'hull was reinforced with copper plates'],
      ['vessel', 'deck leaked badly in heavy weather'],
      ['schooner', 'crew consisted of eleven men'],
    ],
    note: 'One ship owns one hull, so the possessive is singular; the plural form quietly changes the meaning.',
  },
  {
    id: 'SIN-2',
    diff: 'medium',
    pres: [
      'The board met for three hours on Monday morning and issued no statement afterward.',
      'Staff were told to expect a short announcement before lunch, then heard nothing all day.',
      'The decision had been expected for several weeks and surprised almost nobody in the building.',
    ],
    items: [
      ['director', 'decision was announced to the staff'],
      ['keeper', 'office sits at the top of the tower'],
      ['curator', 'notes fill four notebooks'],
    ],
    note: 'Only one person holds the role, so the possessive is singular even though the apostrophe sits next to a plural-looking s.',
  },
];

for (const f of sing) {
  for (const pre of f.pres) {
    for (const [base, tail] of f.items) {
      add(
        f.id,
        SK.SING,
        RULE.SING,
        f.diff,
        `${pre} The ______ ${tail}.`,
        [
          o(`${base}'s`, true, 'correct'),
          o(`${base}s`, false, 'uses the plain plural, which cannot show possession'),
          o(`${base}s'`, false, 'uses a plural possessive even though the sentence describes one owner'),
          o(`${base}'s'`, false, 'adds an apostrophe on both sides of the s'),
        ],
        new RegExp(`^${base}'s$`),
        f.note
      );
    }
  }
}

/* ---------------- plural possession ---------------- */

const plur = [
  {
    id: 'PLU-1',
    diff: 'easy',
    pres: [
      'The colony has been surveyed every spring since 1994 by a team of trained volunteers.',
      'Volunteers walk the beach at dawn throughout the nesting season, counting shells and tracks.',
      'The count is reported to the state every June and published in a short annual bulletin.',
    ],
    items: [
      ['bird', 'nests were counted along the dunes'],
      ['turtle', 'tracks marked the sand above the tide line'],
      ['gull', 'calls filled the air before sunrise'],
    ],
    note: 'Many birds own many nests, so the apostrophe follows the plural s; putting it before the s makes the owner singular.',
  },
  {
    id: 'PLU-2',
    diff: 'medium',
    pres: [
      'The school closed early because of the approaching storm and sent everyone home by noon.',
      'Parents waited under the portico for the buses to arrive, watching the sky to the west.',
      'The storm had been forecast since the weekend, but the county expected only rain.',
    ],
    items: [
      ['child', 'coats were hung in the cloakroom'],
      ['woman', 'committee met in the library'],
      ['man', 'team finished the roof before the rain'],
    ],
    note: 'The plural does not end in s, so the possessive adds an apostrophe and then an s.',
  },
];

for (const f of plur) {
  for (const pre of f.pres) {
    for (const [base, tail] of f.items) {
      const plural = base === 'child' ? 'children' : base === 'woman' ? 'women' : 'men';
      add(
        f.id,
        SK.PLUR,
        RULE.PLUR,
        f.diff,
        `${pre} The ______ ${tail}.`,
        [
          o(`${plural}'s`, true, 'correct'),
          o(`${plural}s'`, false, 'treats an irregular plural as if it ended in s'),
          o(`${base}'s`, false, 'uses the singular possessive even though the sentence describes a group'),
          o(`${plural}`, false, 'leaves the noun plural with no apostrophe at all'),
        ],
        new RegExp(`^${plural}'s$`),
        f.note
      );
    }
  }
}

/* ---------------- names ending in s ---------------- */

const names = [
  {
    id: 'NAM-1',
    diff: 'medium',
    pres: [
      'The author had worked as a clerk in a shipping office for twenty years before he published anything.',
      'Critics ignored the book when it first appeared and reviewed it again only after his death.',
      'The novel is now taught in three hundred schools and has never gone out of print.',
    ],
    items: [
      ['Collins', 'first novel appeared in 1953'],
      ['Dickens', 'later novels were serialized monthly'],
      ['James', 'short stories were collected in 1909'],
    ],
    note: 'The name is singular even though it ends in s, so the possessive is apostrophe plus s, not a bare apostrophe.',
  },
  {
    id: 'NAM-2',
    diff: 'hard',
    pres: [
      'The survey was completed in the summer of 1911 after two seasons of unusually good weather.',
      'The results filled a single bound volume that the society printed at its own expense.',
      'The foundation has supported fieldwork in the region ever since, though on a smaller scale.',
    ],
    items: [
      ['Hawkins', 'estate paid for the expedition'],
      ['Hastings', 'widow donated the papers'],
      ['Brooks', 'laboratory published the results'],
    ],
    note: 'The apostrophe-only form is common in journalism, but edited American prose keeps the extra s for singular names.',
  },
];

for (const f of names) {
  for (const pre of f.pres) {
    for (const [name, tail] of f.items) {
      add(
        f.id,
        SK.NAME,
        RULE.NAME,
        f.diff,
        `${pre} ______ ${tail}.`,
        [
          o(`${name}'s`, true, 'correct'),
          o(`${name}'`, false, 'leaves off the s that a singular name ending in s still takes'),
          o(`${name}`, false, 'uses the bare name with no possessive marker'),
          o(`${name}'s'`, false, 'adds a second apostrophe after the s'),
        ],
        new RegExp(`^${name}'s$`),
        f.note
      );
    }
  }
}

/* ---------------- contractions ---------------- */

const contr = [
  {
    id: 'CON-1',
    diff: 'easy',
    pres: [
      'The survey was scheduled to end in March but ran three weeks past its deadline.',
      'Two of the four sites were still being mapped when the first snow came.',
      'The final report is due in the fall and will be posted on the county website.',
    ],
    items: [
      ['The researchers ______ finished the survey', "haven't", ['havent', "have'nt", "hasn't"]],
      ['The surveyors ______ returned from the field', "haven't", ['havent', "haven' t", "hasn't"]],
      ['The reviewers ______ seen the raw data', "haven't", ['havent', "have'nt", "has't"]],
    ],
    note: 'The apostrophe replaces the dropped "o" in "not", and the helping verb must agree with the plural subject.',
  },
  {
    id: 'CON-2',
    diff: 'medium',
    pres: [
      'The inspection is scheduled for the first week of May, assuming the weather holds and the parts arrive.',
      'The coastal road carries about nine thousand cars a day during the summer season.',
      'Engineers will examine the bearings while the span is closed and report back in June.',
    ],
    items: [
      ['The bridge ______ be closed for more than a week', "won't", ['wont', "wo'nt", "willn't"]],
      ['The ferry ______ run during the closure', "won't", ['wont', "w'll not", "won't'"]],
      ['The detour ______ add more than ten minutes', "won't", ['wont', "will'nt", "wo'nt"]],
    ],
    note: '"Will not" contracts to "won\'t", with the apostrophe standing in for the missing "o".',
  },
];

for (const f of contr) {
  for (const pre of f.pres) {
    for (const [stem, ans, bad] of f.items) {
      add(
        f.id,
        SK.CONTR,
        RULE.CONTR,
        f.diff,
        `${pre} ${stem}.`,
        [
          o(ans, true, 'correct'),
          o(bad[0], false, 'drops the apostrophe that marks the missing letters'),
          o(bad[1], false, 'puts the apostrophe somewhere other than where letters were dropped'),
          o(bad[2], false, 'uses a helping verb that does not agree with the subject'),
        ],
        new RegExp(`^${ans.replace("'", "'")}$`),
        f.note
      );
    }
  }
}

/* ---------------- its / it's ---------------- */

const its = [
  {
    id: 'ITS-1',
    diff: 'easy',
    pres: [
      'The laboratory published its findings in April after two rounds of internal review.',
      'The study had taken nearly three years to complete and involved four separate field sites.',
      'Two journals had asked to see the data first, and both declined to publish it.',
    ],
    items: [
      'The laboratory published ______ findings in April',
      'The station submitted ______ annual report in June',
      'The institute moved ______ library to the second floor',
    ],
    note: 'The possessive of "it" never takes an apostrophe; "it\'s" would read as "it is" and break the sentence.',
  },
  {
    id: 'ITS-2',
    diff: 'medium',
    pres: [
      'The tide has been running higher since the storm and the gauge has been replaced twice.',
      'The gauge at the pier has been repaired twice since it was installed in 1998.',
      'Nobody expects the water to fall before Friday, when the next tide cycle begins.',
    ],
    items: ['______ clear that the tide has turned', '______ been three years since the last survey', '______ unlikely that the ferry will run tonight'],
    note: 'The blank needs a subject and a verb, so the contraction is required; "its" cannot start a clause.',
  },
];

for (const f of its) {
  const possessive = f.id === 'ITS-1';
  for (const pre of f.pres) {
    for (const stem of f.items) {
      const ans = possessive ? 'its' : "It's";
      const bad = possessive ? ["it's", "its'", 'it is'] : ['Its', "Its'", "It'is"];
      add(
        f.id,
        SK.ITS,
        RULE.ITS,
        f.diff,
        `${pre} ${stem}.`,
        [
          o(ans, true, 'correct'),
          o(bad[0], false, possessive ? 'adds an apostrophe to a possessive pronoun' : 'drops the apostrophe from a contraction'),
          o(bad[1], false, 'adds an apostrophe that belongs to neither form'),
          o(bad[2], false, 'substitutes a form that cannot fill this slot'),
        ],
        possessive ? /^its$/ : /^It's$/,
        f.note
      );
    }
  }
}

/* ---------------- whose / who's ---------------- */

const whose = [
  {
    id: 'WHO-1',
    diff: 'medium',
    pres: [
      'The pavilion was completed in 1998 and has since become the most photographed building in town.',
      'The commission reviewed nine entries that year and took four months to reach a decision.',
      'The building now houses a small gallery on the ground floor and a room of drawings above.',
    ],
    items: [
      'The architect ______ design won the competition retired in 2004',
      'The engineer ______ drawings filled the archive died young',
      'The builder ______ firm took the contract later moved west',
    ],
    note: 'The blank stands before a noun it modifies, which is the possessive job of "whose".',
  },
  {
    id: 'WHO-2',
    diff: 'hard',
    pres: [
      'The retrofit will take about eighteen months and will close one lane at a time.',
      'The bridge carries two lanes in each direction and about nine thousand cars a day.',
      'Work begins after Labor Day and is scheduled to finish before the spring thaw.',
    ],
    items: [
      "The engineer ______ overseeing the retrofit will speak on Monday",
      "The inspector ______ reviewing the bearings asked for more tests",
      "The contractor ______ finishing the deck has not filed a schedule",
    ],
    note: 'The blank is followed by a participle doing the work of a verb, so the contraction of "who is" is needed.',
  },
];

for (const f of whose) {
  const possessive = f.id === 'WHO-1';
  for (const pre of f.pres) {
    for (const stem of f.items) {
      const ans = possessive ? 'whose' : "who's";
      const bad = possessive ? ["who's", 'whos', "whose'"] : ['whose', 'whos', "whose'se"];
      add(
        f.id,
        SK.WHOSE,
        RULE.WHOSE,
        f.diff,
        `${pre} ${stem}.`,
        [
          o(ans, true, 'correct'),
          o(bad[0], false, possessive ? 'substitutes the contraction of "who is" for the possessive' : 'substitutes the possessive for the contraction'),
          o(bad[1], false, 'drops the apostrophe or the final s, producing a spelling that does not exist'),
          o(bad[2], false, 'adds an apostrophe to a possessive form that needs none'),
        ],
        possessive ? /^whose$/ : /^who's$/,
        f.note
      );
    }
  }
}

/* ---------------- quotation marks ---------------- */

const quote = [
  {
    id: 'QUO-1',
    diff: 'medium',
    pres: [
      'The engineers spent two years on the study and interviewed every keeper still living.',
      'The county has debated the issue since 1998 without ever reaching a conclusion.',
      'The report runs to three hundred pages and includes forty pages of charts.',
    ],
    items: [
      ['The report concluded', 'the harbor needs deeper dredging'],
      ['The summary states', 'the channel has narrowed by half'],
      ['The appendix notes', 'the outer bar shifts every winter'],
    ],
    note: 'In American style the period belongs inside the closing quotation mark, not after it.',
  },
  {
    id: 'QUO-2',
    diff: 'hard',
    pres: [
      'The log entries were written in pencil and have faded badly along the margins.',
      'The keeper rarely wrote more than two lines a night, even during the worst storms.',
      'The volume is kept in a case by the window and is handled only with gloves.',
    ],
    items: [
      ['the keeper wrote in his log', 'The light held through the night'],
      ['the captain noted in the margin', 'No damage to the hull'],
      ['the surveyor added at the end', 'The tide ran two feet above the mark'],
    ],
    note: 'A quoted statement followed by an attribution takes a comma inside the quotation marks.',
  },
];

for (const f of quote.slice(0, 1)) {
  for (const pre of f.pres) {
    for (const [lead, q] of f.items) {
      add(
        f.id,
        SK.QUOTE,
        RULE.QUOTE,
        f.diff,
        `${pre} ${lead}, ______`,
        [
          o(`"${q}."`, true, 'correct'),
          o(`"${q}".`, false, 'places the period outside the closing quotation mark'),
          o(`"${q}"`, false, 'omits the period that ends the sentence inside the quotation'),
          o(`${q}."`, false, 'omits the opening quotation mark'),
        ],
        /^"[\s\S]*\."$/,
        f.note
      );
    }
  }
}

for (const f of quote.slice(1)) {
  for (const pre of f.pres) {
    for (const [lead, q] of f.items) {
      add(
        f.id,
        SK.QUOTE,
        RULE.QUOTE,
        f.diff,
        `${pre} ______ ${lead}.`,
        [
          o(`"${q},"`, true, 'correct'),
          o(`"${q}"`, false, 'omits the comma that separates the quotation from its attribution'),
          o(`"${q}",`, false, 'places the comma outside the closing quotation mark'),
          o(`${q},"`, false, 'omits the opening quotation mark'),
        ],
        /^"[\s\S]*,"$/,
        f.note
      );
    }
  }
}

/* ---------------- hyphens vs dashes ---------------- */

const hyph = [
  {
    id: 'HYP-1',
    diff: 'easy',
    pres: [
      'The case for the link has been argued for decades without convincing the county.',
      'Two independent teams reviewed the evidence last year and reached the same conclusion.',
      'The county has not yet committed any money to the work or set a start date.',
    ],
    items: [
      ['well-documented', 'The report cites a ______ study of the crossing'],
      ['long-term', 'The survey found a ______ decline in the fishery'],
      ['high-resolution', 'The appendix includes a ______ map of the estuary'],
    ],
    note: 'A compound modifier before a noun takes a hyphen, and only a hyphen; an em dash is a punctuation mark, not a joiner.',
  },
  {
    id: 'HYP-2',
    diff: 'medium',
    pres: [
      'Construction began in 1902 and ended two years later, ahead of schedule and under budget.',
      'The span carried its first train in the spring of 1904, three months after the official opening.',
      'Freight traffic ended in 1971, and the line was abandoned the following year.',
    ],
    items: [
      ['ten-year', 'The ______ project ran over budget twice'],
      ['two-lane', 'A ______ road now follows the old rail bed'],
      ['nineteenth-century', 'The ______ bridge was retrofitted in 1998'],
    ],
    note: 'Numbers in a compound modifier are hyphenated, and an en dash used for a range is not a substitute.',
  },
  {
    id: 'HYP-3',
    diff: 'very_hard',
    pres: [
      'The committee reviewed the proposal twice before sending it back to the author.',
      'The final version ran to nine pages, down from thirty-one in the first draft.',
      'The board approved it without any discussion and moved to the next item.',
    ],
    items: [
      ['carefully worded', 'The ______ report avoided every technical term'],
      ['widely cited', 'The ______ study has been replicated three times'],
      ['closely argued', 'The ______ essay runs to forty pages'],
    ],
    note: 'An -ly adverb is never joined to the word it modifies with a hyphen, however compound the phrase looks.',
  },
];

for (const f of hyph.slice(0, 2)) {
  for (const pre of f.pres) {
    for (const [adj, sentence] of f.items) {
      const [first, second] = adj.split('-');
      add(
        f.id,
        SK.HYPH,
        RULE.HYPH,
        f.diff,
        `${pre} ${sentence}.`,
        [
          o(adj, true, 'correct'),
          o(`${first} ${second}`, false, 'leaves the compound unhyphenated, so it reads as two separate modifiers'),
          o(`${first}—${second}`, false, 'uses an em dash where a hyphen belongs'),
          o(`${first}–${second}`, false, 'uses an en dash, which marks ranges, not compounds'),
        ],
        new RegExp(`^${first}-${second}$`),
        f.note
      );
    }
  }
}

for (const f of hyph.slice(2)) {
  for (const pre of f.pres) {
    for (const [adj, sentence] of f.items) {
      const [adv, part] = adj.split(' ');
      add(
        f.id,
        SK.HYPH,
        RULE.HYPH,
        f.diff,
        `${pre} ${sentence}.`,
        [
          o(adj, true, 'correct'),
          o(`${adv}-${part}`, false, 'hyphenates an -ly adverb to the word it modifies'),
          o(`${adv}—${part}`, false, 'uses an em dash inside a noun phrase'),
          o(`${adv.slice(0, -2)}-${part}`, false, 'drops the -ly ending and hyphenates, producing a different word'),
        ],
        new RegExp(`^${adv} ${part}$`),
        f.note
      );
    }
  }
}

export const boundaryFrames2 = out;
export const frameCount2 = 17;
