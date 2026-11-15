// Boundary items, part 1: sentence-joining punctuation, appositives, series,
// and the no-punctuation-between-subject-and-verb rule.
import { o, cap } from '../lib/core.mjs';

const SK = {
  SEMI: 'Boundaries: semicolons',
  SPLICE: 'Boundaries: comma splices and periods',
  COLON: 'Boundaries: colons',
  DASH: 'Boundaries: dashes',
  APPOS: 'Boundaries: nonessential appositives',
  ESS: 'Boundaries: essential elements',
  INTRO: 'Boundaries: introductory elements',
  SERIES: 'Boundaries: series',
  SV: 'Boundaries: subject-verb punctuation',
};

const RULE = {
  SEMI: 'A semicolon may join two independent clauses that are closely related, but it may not join a clause to a fragment, and a comma or a colon cannot do its work.',
  SPLICE: 'Two independent clauses must be separated by a period (or a semicolon); a comma alone between them is a comma splice, and no mark at all is a fused sentence.',
  COLON: 'A colon after an independent clause signals that a list or an explanation follows; a semicolon or comma cannot introduce a list, and a list cannot simply be run on.',
  DASH: 'A pair of dashes sets off an interruption, and both marks must match; when the interruption itself contains commas or a full clause, dashes are the only workable choice.',
  APPOS: 'A nonessential appositive is set off by commas on both sides; omitting either comma fuses the appositive into the sentence.',
  ESS: 'An essential (restrictive) element identifies which one is meant, so it takes no commas; setting it off with commas changes the meaning and mispunctuates the sentence.',
  INTRO: 'An introductory word, phrase, or clause is followed by a comma before the main clause begins.',
  SERIES: 'Items in a series are separated by commas, with a comma before the conjunction; semicolons belong only in a series whose items already contain commas.',
  SV: 'No punctuation may separate a subject from its verb or a verb from its object.',
};

const RULE_SHORT = {
  SEMI: 'A semicolon joins two independent clauses.',
  SPLICE: 'Independent clauses need a period or semicolon, not a comma.',
  COLON: 'A colon introduces a list or explanation after an independent clause.',
  DASH: 'Dashes must be used in matching pairs around an interruption.',
  APPOS: 'A nonessential appositive takes commas on both sides.',
  ESS: 'Essential elements take no commas.',
  INTRO: 'An introductory element is followed by a comma.',
  SERIES: 'Series items are separated by commas.',
  SV: 'Never separate subject and verb with punctuation.',
};

const out = [];

function add(frame, skill, rule, diff, passage, options, expect, skillNote) {
  out.push({
    frame: frame,
    skill,
    rule,
    difficulty: diff,
    passage,
    options,
    expect,
    skillNote,
  });
}

/* ---------------- semicolons ---------------- */

const semi = [
  {
    id: 'SEM-1',
    diff: 'easy',
    pres: [
      "The harbor master's office keeps its tide charts in a cedar cabinet.",
      'Visitors to the small maritime museum often ask to see the original tide ledgers.',
      'Nothing in the office is locked, and nothing has ever been lost.',
    ],
    pairs: [
      ['The earliest chart in the drawer is dated 1893', 'the most recent was completed last spring'],
      ['The ink on the older pages has faded to brown', 'the pencil entries are still perfectly sharp'],
      ['Two volumes are missing from the shelf', 'a note in the index records where they went'],
    ],
    note: 'Both sides of the blank are complete sentences; the trap is treating the second one as an afterthought and reaching for a comma.',
  },
  {
    id: 'SEM-2',
    diff: 'medium',
    pres: [
      'Astronomers at the mountain station still write their observations by hand.',
      'The archive occupies a locked room beneath the dome.',
      'Every clear night for a century has left a trace in the same four cabinets.',
    ],
    pairs: [
      ["The observatory's logbooks record every clear night since 1911", 'the entries now fill nineteen bound volumes'],
      ['The telescope was rebuilt twice in the 1960s', 'its original mirror still sits in the lobby'],
      ['A fire in 1974 destroyed the wooden shutters of the dome', 'the instrument itself was unharmed'],
    ],
    note: 'Long clauses make the comma feel natural; check each side for its own subject and verb before choosing.',
  },
  {
    id: 'SEM-3',
    diff: 'hard',
    pres: [
      'Fieldwork in the region has always depended on volunteers.',
      'The collection has outgrown three separate storage rooms.',
      'Nobody expected the project to last more than a season.',
    ],
    pairs: [
      [
        'The survey, which began in 1998 and ended last year, covered four hundred kilometers of coastline',
        'its data now support a dozen separate studies',
      ],
      [
        "The herbarium's oldest specimens, some collected before 1850, are stored in sealed cases",
        'researchers consult them only with gloves',
      ],
      [
        "The orchestra's archive, donated by a former conductor, includes nine hundred scores",
        'a grant will pay to digitize them',
      ],
    ],
    note: 'Internal commas on the left side tempt you toward a comma at the join; the clause boundaries are what matter.',
  },
];

for (const f of semi) {
  for (const pre of f.pres) {
    for (const [a, b] of f.pairs) {
      add(
        f.id,
        SK.SEMI,
        RULE.SEMI,
        f.diff,
        `${pre} ${a} ______`,
        [
          o(`; ${b}.`, true, 'correct'),
          o(`, ${b}.`, false, 'puts only a comma between two independent clauses, which is a comma splice'),
          o(` ${b}.`, false, 'leaves the two independent clauses with no mark between them, which is a fused sentence'),
          o(`: ${b}.`, false, 'uses a colon although the second clause neither explains nor lists the first'),
        ],
        /^;\s/,
        f.note
      );
    }
  }
}

/* ---------------- comma splice vs period ---------------- */

const splice = [
  {
    id: 'SPL-1',
    diff: 'easy',
    pres: [
      "The studio's notebook records every firing, successful or not.",
      'Clay arrives at the workshop in fifty-pound blocks.',
      'Apprentices spend their first month wedging clay and cleaning tools.',
    ],
    pairs: [
      ['The first kiln was fired on a Tuesday', 'it cracked before the end of the week'],
      ['The potter had mixed the clay by hand', 'the batch still dried unevenly'],
      ['A second kiln was built in the spring', 'it has run without a problem since'],
    ],
    note: 'A comma before a new subject and verb is the most common splice; the period is doing real work here.',
  },
  {
    id: 'SPL-2',
    diff: 'medium',
    pres: [
      'Geologists describe the valley as a textbook case of meander migration.',
      'The county historical society keeps a folder of photographs from the 1930s.',
      'Nobody has been able to date the shift more precisely.',
    ],
    pairs: [
      ['The river changed course sometime in the 1700s', 'the old channel is still visible from the ridge'],
      ['Farmers in the valley have always known about the shift', 'the soil on the east bank is a different color'],
      ['A survey team mapped the former bed last summer', 'their map is now used in local schools'],
    ],
    note: 'Two statements that feel related still need a full stop; relatedness is not a grammatical license.',
  },
  {
    id: 'SPL-3',
    diff: 'hard',
    pres: [
      'Replication has become a quiet obsession in the field.',
      'The reviewers published their assessment in a four-page memo.',
      'Both laboratories had expected the result to be contested.',
    ],
    pairs: [
      [
        'Although the two laboratories used different methods, their results agreed to within a tenth of a percent',
        'the agreement surprised everyone involved',
      ],
      ['The team repeated the experiment three times over two years', 'each run produced the same curve'],
      ['After the second round of tests, the reviewers asked for the raw data', 'the files arrived within a week'],
    ],
    note: 'An introductory dependent clause hides the fact that a new independent clause starts after the blank.',
  },
];

for (const f of splice) {
  for (const pre of f.pres) {
    for (const [a, b] of f.pairs) {
      add(
        f.id,
        SK.SPLICE,
        RULE.SPLICE,
        f.diff,
        `${pre} ${a} ______`,
        [
          o(`. ${cap(b)}.`, true, 'correct'),
          o(`, ${b}.`, false, 'joins two independent clauses with a comma alone, which is a comma splice'),
          o(` ${b}.`, false, 'runs the two independent clauses together with no punctuation, which is a fused sentence'),
          o(`: ${b}.`, false, 'uses a colon although the second statement does not explain the first'),
        ],
        /^\.\s+[A-Z]/,
        f.note
      );
    }
  }
}

/* ---------------- colons ---------------- */

const colon = [
  {
    id: 'COL-1',
    diff: 'easy',
    pres: [
      'The maritime museum opens a new gallery this month.',
      'Attendance has doubled since the gallery opened.',
      'The objects on display came from three private collections.',
    ],
    pairs: [
      ['The curator chose three objects for the display case', "a brass compass, a folded chart, and a ship's log"],
      ['The lecture covered three kinds of evidence', "letters, photographs, and pages from a keeper's diary"],
      ['The director set two conditions for the loan', 'climate-controlled storage and a written appraisal'],
    ],
    note: 'The list is not a clause, so a semicolon is wrong and a comma will not signal that the list is coming.',
  },
  {
    id: 'COL-2',
    diff: 'medium',
    pres: [
      'Biologists have monitored the estuary since the 1980s.',
      "The reserve's annual report runs to sixty pages.",
      'Funding comes from a state trust and a private foundation.',
    ],
    pairs: [
      ['The survey team measured three things at every station', 'water temperature, salinity, and dissolved oxygen'],
      ['The report identified two causes of the decline', 'warmer water and a sharp drop in eelgrass'],
      [
        'The reserve protects four species of special concern',
        'the piping plover, the diamondback terrapin, and two kinds of beach grass',
      ],
    ],
    note: 'A colon works after any complete clause, but only when what follows delivers the list the clause promised.',
  },
  {
    id: 'COL-3',
    diff: 'hard',
    pres: [
      'The dig began as a routine survey before a road project.',
      'Every object in the room was photographed where it lay.',
      'The room had been sealed for more than a thousand years.',
    ],
    pairs: [
      [
        'What the excavation eventually revealed was a single room containing three objects',
        'a bronze lamp, a set of iron keys, and a small painted bowl',
      ],
      [
        'The conservators asked the donor for one thing before the opening',
        'a signed statement describing where the painting had hung',
      ],
      ['The archive holds only what survived the flood', 'two ledgers, a bundle of letters, and one photograph'],
    ],
    note: 'The long subject delays the colon, but the test is unchanged: complete clause first, list second.',
  },
];

for (const f of colon) {
  for (const pre of f.pres) {
    for (const [a, list] of f.pairs) {
      add(
        f.id,
        SK.COLON,
        RULE.COLON,
        f.diff,
        `${pre} ${a} ______`,
        [
          o(`: ${list}.`, true, 'correct'),
          o(`; ${list}.`, false, 'uses a semicolon even though the words that follow are a list, not an independent clause'),
          o(`, ${list}.`, false, 'attaches the list to the clause with a comma, which does not announce that a list follows'),
          o(` ${list}.`, false, 'runs the list onto the clause with no punctuation at all'),
        ],
        /^:\s/,
        f.note
      );
    }
  }
}

/* ---------------- dashes ---------------- */

const dash = [
  {
    id: 'DSH-1',
    diff: 'easy',
    pres: [
      'The lighthouse museum occupies the old keeper\'s cottage.',
      'Few visitors realize how much paperwork the job once required.',
      'The building was restored with money raised by local schoolchildren.',
    ],
    triples: [
      ["The keeper's log", 'it fills four shelves in the archive', 'was donated by his granddaughter'],
      ["The station's daily journal", 'it records every wreck within sight of the light', 'has never been published'],
      ['The original lens', 'it weighs almost nine hundred pounds', 'is kept in a case downstairs'],
    ],
    note: 'The interruption is a full clause; commas around it would produce a comma splice, so the dashes are not decorative.',
  },
  {
    id: 'DSH-2',
    diff: 'medium',
    pres: [
      'The railroad reached the coast in 1873.',
      'Restoration work on the harbor district began last year.',
      'The structure has outlasted every building around it.',
    ],
    triples: [
      [
        "The surveyor's map",
        'a route that crossed two rivers, three rail lines, and a mountain pass',
        'guided the railroad for forty years',
      ],
      ['The mortar', 'a mixture of sand, crushed shell, and lime', 'has held for three centuries'],
      [
        'The old hall',
        'a building that served as a school, a church, and a courthouse',
        'was finally torn down in 1962',
      ],
    ],
    note: "When the aside has its own commas, a second pair of commas makes the sentence unreadable; dashes keep the boundaries visible.",
  },
  {
    id: 'DSH-3',
    diff: 'very_hard',
    pres: [
      'Engineers still study the structure for its innovations.',
      'Local historians fought for years to keep the structure standing.',
      'The crossing carried freight for more than half a century.',
    ],
    triples: [
      ['The bridge', 'the longest suspension span of its day', 'closed for repairs in 1987'],
      ['The tower', 'a landmark visible from three counties', 'lost its lantern room in the 1953 storm'],
      ['The canal', 'the first in the state to use concrete locks', 'carried freight until 1928'],
    ],
    note: 'Only the opening mark is missing; a comma there clashes with the dash that closes the aside.',
  },
];

for (const f of dash.slice(0, 2)) {
  for (const pre of f.pres) {
    for (const [subj, aside, tail] of f.triples) {
      add(
        f.id,
        SK.DASH,
        RULE.DASH,
        f.diff,
        `${pre} ${subj} ______ ${tail}.`,
        [
          o(`— ${aside} —`, true, 'correct'),
          o(`, ${aside},`, false, 'puts commas around a full clause, which creates a comma splice'),
          o(`— ${aside},`, false, 'opens the interruption with a dash and closes it with a comma'),
          o(`, ${aside} —`, false, 'opens the interruption with a comma and closes it with a dash'),
        ],
        /^—[\s\S]*—$/,
        f.note
      );
    }
  }
}

for (const f of dash.slice(2)) {
  for (const pre of f.pres) {
    for (const [subj, aside, tail] of f.triples) {
      add(
        f.id,
        SK.DASH,
        RULE.DASH,
        f.diff,
        `${pre} ${subj} ______ ${aside} — ${tail}.`,
        [
          o('—', true, 'correct'),
          o(',', false, 'opens the aside with a comma but the aside closes with a dash, so the pair does not match'),
          o(';', false, 'uses a semicolon to open a parenthetical interruption, which semicolons cannot do'),
          o(':', false, 'uses a colon to open an interruption that the sentence then closes with a dash'),
        ],
        /^—$/,
        f.note
      );
    }
  }
}

/* ---------------- nonessential appositives ---------------- */

const appos = [
  {
    id: 'APP-1',
    diff: 'easy',
    pres: [
      'The 1897 expedition lasted nineteen months and covered more than a thousand miles.',
      'Only six of the original twelve members returned, and two of them never spoke of it.',
      'The society published the log in a limited edition of four hundred copies.',
    ],
    triples: [
      [
        "The expedition's leader",
        'a geologist trained in Vienna',
        'kept a daily log that later became a primary source',
      ],
      ["The ship's captain", 'a former navy pilot', 'rarely spoke about the crossing'],
      ["The team's botanist", 'a specialist in alpine grasses', 'collected specimens at every stop'],
    ],
    note: 'An appositive is a rename, not a sentence: it needs a comma on each side, and a semicolon before it is impossible.',
  },
  {
    id: 'APP-2',
    diff: 'medium',
    pres: [
      'Mapping the seafloor in the 1950s meant long hours over a drafting table.',
      'The sketches were rediscovered in an attic in 1998.',
      'The society has digitized most of the surviving plates.',
    ],
    triples: [
      ['The cartographer', 'a draftsman who had never seen the ocean', 'spent eleven years on the map'],
      [
        'The youngest member of the crew',
        'a carpenter from a village near the harbor',
        'kept the only surviving sketchbook',
      ],
      [
        "The expedition's photographer",
        'a former studio assistant from Boston',
        'left behind three hundred glass plates',
      ],
    ],
    note: 'The appositive is long enough to look like a clause; count the commas on both sides of it.',
  },
  {
    id: 'APP-3',
    diff: 'hard',
    pres: [
      'The award is given every other year.',
      'The collection had been in a barn for sixty years.',
      'The lecture drew a larger crowd than expected.',
    ],
    pairs: [
      ['The prize went to the youngest member of the survey', 'a cartographer who had joined the team only a year earlier'],
      ['The collection was donated by a local family', 'the descendants of the original lighthouse keeper'],
      ['The lecture was illustrated with a single map', 'a hand-drawn chart of the harbor as it looked in 1802'],
    ],
    note: 'At the end of a sentence the appositive needs only one comma, and it must not pick up a second one before the period.',
  },
];

for (const f of appos) {
  for (const pre of f.pres) {
    if (f.triples) {
      for (const [subj, app, tail] of f.triples) {
        add(
          f.id,
          SK.APPOS,
          RULE.APPOS,
          f.diff,
          `${pre} ${subj} ______ ${tail}.`,
          [
            o(`, ${app},`, true, 'correct'),
            o(` ${app},`, false, 'omits the comma before the appositive, so the rename runs into the subject'),
            o(`, ${app}`, false, 'omits the comma after the appositive, so the main clause runs into the rename'),
            o(`; ${app},`, false, 'puts a semicolon in front of a phrase that is not an independent clause'),
          ],
          /^,\s[\s\S]*,$/,
          f.note
        );
      }
    } else {
      for (const [subj, app] of f.pairs) {
        add(
          f.id,
          SK.APPOS,
          RULE.APPOS,
          f.diff,
          `${pre} ${subj} ______`,
          [
            o(`, ${app}.`, true, 'correct'),
            o(` ${app}.`, false, 'attaches the appositive with no comma, so it reads as part of the noun phrase'),
            o(`; ${app}.`, false, 'uses a semicolon before a phrase that cannot stand alone'),
            o(`, ${app},`, false, 'adds a second comma before the period, leaving the appositive unclosed'),
          ],
          /^,\s[^;]*[^,]\.$/,
          f.note
        );
      }
    }
  }
}

/* ---------------- essential elements ---------------- */

const essential = [
  {
    id: 'ESS-1',
    diff: 'easy',
    pres: [
      'The archive is open on weekdays and closes at four in the afternoon.',
      'Access to the collection is controlled at the front desk, where badges are checked.',
      'The basement lab is closed for renovation until June, when the new cases arrive.',
    ],
    triples: [
      ['Employees', 'who have completed the safety course', 'may use the archive after hours'],
      ['Visitors', 'whose badges have expired', 'must check in at the front desk'],
      ['Technicians', 'who work in the basement lab', 'have their own entrance'],
    ],
    note: 'The clause tells you which employees, so it is essential; commas would imply all employees and turn the clause into an aside.',
  },
  {
    id: 'ESS-2',
    diff: 'medium',
    pres: [
      'The report runs to two hundred pages and has already been cited twice.',
      'The crossing closes twice a year for inspection, once in spring and once in fall.',
      'The facility holds more than four thousand varieties of seed and is expanding.',
    ],
    triples: [
      ['The report', 'that the committee commissioned in 2019', 'was finally released in June'],
      ['The bridge', 'that carries the coastal road', 'will close for inspection in May'],
      ['The seed bank', 'that stores thousands of varieties', 'relies on backup power'],
    ],
    note: 'A "that" clause is always essential in edited American English, so it never takes commas.',
  },
  {
    id: 'ESS-3',
    diff: 'hard',
    pres: [
      'The county has changed a great deal since the bridge was widened in 1968.',
      'The species was named in 1912 by a botanist who never saw it alive.',
      'The collection was moved to the east wing in 1998 and has stayed there since.',
    ],
    triples: [
      ['The only bridge', 'that crosses the river within the county', 'was built in 1902'],
      ['The first scientist', 'who described the species', 'was a country doctor'],
      ['The one gallery', 'that survived the 1974 fire', 'now holds the glass collection'],
    ],
    note: 'Words like "only", "first", and "one" make the clause identifying, so no commas belong around it.',
  },
];

for (const f of essential) {
  for (const pre of f.pres) {
    for (const [subj, rel, tail] of f.triples) {
      add(
        f.id,
        SK.ESS,
        RULE.ESS,
        f.diff,
        `${pre} ${subj} ______ ${tail}.`,
        [
          o(` ${rel}`, true, 'correct'),
          o(`, ${rel},`, false, 'sets off an essential clause with commas, which implies the sentence could do without it'),
          o(`, ${rel}`, false, 'adds a comma after the noun but never closes the clause'),
          o(`; ${rel}`, false, 'uses a semicolon before a dependent clause'),
        ],
        /^ [A-Za-z]/,
        f.note
      );
    }
  }
}

/* ---------------- introductory elements ---------------- */

const intro = [
  {
    id: 'INT-1',
    diff: 'easy',
    pres: [
      "The town's oldest photographs show a forest of masts.",
      'Flood marks are still painted on the wall of the custom house.',
      'The mill closed long before anyone now living was born.',
    ],
    pairs: [
      ['In the winter of 1888', 'the harbor froze solid for six weeks'],
      ['After three days of rain', 'the river rose above its banks'],
      ['By the end of the century', 'the mill had doubled in size'],
    ],
    note: 'Four words of introduction are still an introduction; the comma marks where the main clause starts.',
  },
  {
    id: 'INT-2',
    diff: 'medium',
    pres: [
      'The project began with a grant of nine hundred dollars.',
      'Preparing the site took longer than the fieldwork itself.',
      'The results were published as a single folded sheet.',
    ],
    pairs: [
      ['Having spent two years in the archive', 'she knew the collection better than anyone'],
      ['Unlike the earlier surveys', 'this one measured the river at flood stage'],
      ['To reach the site before dawn', 'the team left the lodge at four'],
    ],
    note: 'A participial or infinitive phrase at the front is an introductory element, however long it runs.',
  },
];

for (const f of intro) {
  for (const pre of f.pres) {
    for (const [lead, main] of f.pairs) {
      add(
        f.id,
        SK.INTRO,
        RULE.INTRO,
        f.diff,
        `${pre} ${lead} ______`,
        [
          o(`, ${main}.`, true, 'correct'),
          o(` ${main}.`, false, 'leaves the introductory element welded to the main clause with no comma'),
          o(`; ${main}.`, false, 'uses a semicolon to attach a mere introductory phrase'),
          o(`: ${main}.`, false, 'uses a colon to attach a phrase that is not a list or an explanation'),
        ],
        /^,\s/,
        f.note
      );
    }
  }
}

/* ---------------- series ---------------- */

const series = [
  {
    id: 'SER-1',
    diff: 'easy',
    pres: [
      'The survey lasted three weeks in calm weather.',
      'Every measurement was recorded twice by different people.',
      'The final report was printed on waterproof paper.',
    ],
    triples: [
      ['The team measured water depth', 'recorded salinity', 'collected sediment samples'],
      ['The workshop covers mixing glazes', 'throwing pots', 'firing a kiln'],
      ['The report lists the causes of the decline', 'the cost of repairs', 'the remedies available to the city'],
    ],
    note: 'Three parallel items take two commas; semicolons only appear when the items themselves contain commas.',
  },
  {
    id: 'SER-2',
    diff: 'medium',
    pres: [
      'The mill has been producing paper since 1811, though the machines are much newer.',
      'Every batch is tested before it leaves the building, and the results are logged.',
      'The recipe has not changed in a hundred years, despite several attempts to modernize it.',
    ],
    triples: [
      ['The finished paper is', 'thin', 'strong, and nearly transparent'],
      ['The mortar is', 'durable', 'cheap, and easy to mix'],
      ['The alloy is', 'light', 'rigid, and resistant to salt'],
    ],
    note: 'With adjectives the commas are doing the same work as with nouns: one between each pair, one before the "and".',
  },
];

for (const f of series) {
  for (const pre of f.pres) {
    for (const [stem, i2, i3] of f.triples) {
      add(
        f.id,
        SK.SERIES,
        RULE.SERIES,
        f.diff,
        `${pre} ${stem} ______`,
        [
          o(`, ${i2}, and ${i3}.`, true, 'correct'),
          o(`; ${i2}; and ${i3}.`, false, 'uses semicolons in a simple series whose items contain no commas'),
          o(` ${i2}, and ${i3}.`, false, 'omits the comma between the first two items'),
          o(`, ${i2}, and, ${i3}.`, false, 'drops a stray comma between the conjunction and the last item'),
        ],
        /^,\s[^,;]+,\s+and\s/,
        f.note
      );
    }
  }
}

/* ---------------- no punctuation between subject and verb / verb and object ---------------- */

const sv = [
  {
    id: 'SVP-1',
    diff: 'easy',
    pres: [
      'The cliff path is closed from November to March, when the nesting season begins.',
      'The colony has been monitored since the 1970s by a rotating group of volunteers.',
      'A county crew repainted the railings last summer and replaced two sections of boardwalk.',
    ],
    pairs: [
      ['The birds that nest on the cliff', 'return each April'],
      ['The bridge built in 1902', 'still carries traffic'],
      ['The letters stored in the attic', 'describe the flood in detail'],
    ],
    note: 'A long subject looks finished before it is; nothing may come between it and its verb.',
  },
  {
    id: 'SVP-2',
    diff: 'medium',
    pres: [
      'The pilot program ran for eighteen months and cost slightly less than projected.',
      'The findings were published as an appendix to the annual report in December.',
      'The archive received the negatives in 2004 from the family of the photographer.',
    ],
    pairs: [
      ['The team studied', 'the effects of the dam on fish migration'],
      ['The commission reviewed', 'every complaint filed during the pilot program'],
      ['The archivist catalogued', 'more than nine hundred photographs'],
    ],
    note: 'A comma between a verb and its object is never right, even when the object is long or begins with a number.',
  },
];

for (const f of sv) {
  for (const pre of f.pres) {
    for (const [subj, tail] of f.pairs) {
      add(
        f.id,
        SK.SV,
        RULE.SV,
        f.diff,
        `${pre} ${subj} ______`,
        [
          o(` ${tail}.`, true, 'correct'),
          o(`, ${tail}.`, false, 'inserts a comma between the subject and its verb or between the verb and its object'),
          o(`; ${tail}.`, false, 'inserts a semicolon inside a single clause'),
          o(`: ${tail}.`, false, 'inserts a colon inside a single clause, where it has nothing to introduce'),
        ],
        /^ [A-Za-z0-9]/,
        f.note
      );
    }
  }
}

export const boundaryFrames1 = out;
export const frameCount1 = 24;
