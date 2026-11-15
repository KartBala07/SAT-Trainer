// Form, Structure, and Sense, part 2: tense, mood, parallelism, modifiers,
// comparisons, and countable versus mass quantifiers.
import { o } from '../lib/core.mjs';

const SK = {
  TC: 'Form: verb tense consistency',
  PF: 'Form: perfect tenses',
  SUB: 'Form: subjunctive mood',
  PAR: 'Form: parallelism in a series',
  NB: 'Form: parallel correlatives',
  MOD: 'Form: dangling and misplaced modifiers',
  AS: 'Form: comparisons with as ... as',
  FL: 'Form: fewer and less',
};

const R = {
  TC: 'Verbs in a sentence, or in a closely linked pair of sentences, keep a consistent tense unless the meaning requires a shift.',
  PF: 'The perfect tenses place an action before a stated time: had for a point in the past, has for the present, will have for a point in the future.',
  SUB: 'A contrary-to-fact condition takes "were", and a demand or request after "that" takes the base form of the verb.',
  PAR: 'Items joined in a series must share the same grammatical form, whether they are verbs, nouns, or whole clauses.',
  NB: 'Correlative conjunctions such as not only ... but also and neither ... nor must join parallel grammatical structures.',
  MOD: 'An introductory modifier must describe the subject of the main clause that follows it, and a modifier must sit next to the word it modifies.',
  AS: 'An equal comparison is built with as ... as; "than" belongs to a comparison of inequality.',
  FL: 'Fewer counts individual items; less measures an amount that cannot be counted.',
};

const out = [];

function frame(id, skill, diff, pre, note, notes, items) {
  out.push({ id, skill, diff, pre, note, notes, items });
}

/* ---------------- verb tense consistency ---------------- */

frame(
  'TC-1',
  SK.TC,
  'easy',
  'The river has shaped the valley for centuries and still floods the lower fields each spring.',
  'A sentence describing a recurring present keeps every verb in the present.',
  [
    'shifts to the past even though the sentence describes a recurring present',
    'uses a perfect tense that the sentence does not call for',
    'uses a participle where a finite verb is required',
  ],
  [
    { p: 'The river rises each spring, and the fields ______.', ok: 'flood', w: ['flooded', 'have flooded', 'flooding'] },
    {
      p: 'The museum opens at nine, and the guards ______ the doors at eight.',
      ok: 'unlock',
      w: ['unlocked', 'have unlocked', 'unlocking'],
    },
    {
      p: 'The wind comes off the water, and the gulls ______ inland.',
      ok: 'move',
      w: ['moved', 'have moved', 'moving'],
    },
  ]
);

frame(
  'TC-2',
  SK.TC,
  'medium',
  'The station closed in 1954 and reopened twenty years later as a small museum.',
  'A past-tense narrative keeps its verbs in the past unless the meaning calls for a shift.',
  [
    'shifts to the present in the middle of a past-tense narrative',
    'uses a perfect tense that the past narrative does not call for',
    'uses a participle where a finite verb is required',
  ],
  [
    {
      p: 'When the tide came in, the workers ______ their tools and left.',
      ok: 'gathered',
      w: ['gather', 'have gathered', 'gathering'],
    },
    {
      p: 'The keeper checked the lamp each evening and ______ the wick.',
      ok: 'trimmed',
      w: ['trims', 'has trimmed', 'trimming'],
    },
    {
      p: 'The survey began in May and ______ until October.',
      ok: 'continued',
      w: ['continues', 'has continued', 'continuing'],
    },
  ]
);

frame(
  'TC-3',
  SK.TC,
  'hard',
  'The station has kept a continuous record since 1911.',
  'When one verb is a present perfect, the verb joined to it by "and" normally shares that auxiliary.',
  [
    'breaks the perfect construction by shifting to another tense',
    'uses a participle where the shared auxiliary requires a past participle',
    'shifts to the simple present in the middle of a perfect construction',
  ],
  [
    {
      p: 'The station has recorded the tide since 1911 and ______ to publish the data.',
      ok: 'continues',
      w: ['continued', 'continuing', 'continue'],
    },
    {
      p: 'The archive has digitized the letters and ______ making the scans public.',
      ok: 'begun',
      w: ['began', 'beginning', 'begins'],
    },
    {
      p: 'The researchers have mapped the reef and ______ the results in a series of reports.',
      ok: 'published',
      w: ['publish', 'publishing', 'were publishing'],
    },
  ]
);

frame(
  'TC-4',
  SK.TC,
  'very_hard',
  'The light was automated long before the station closed.',
  'A past-perfect progressive is needed when one past action had been running up to another.',
  [
    'uses the present perfect with a time frame that ended in the past',
    'uses the simple past progressive, which loses the sense of an action completed before another',
    'uses the simple past where the earlier of two past actions needs the past perfect',
  ],
  [
    {
      p: 'By the time the last keeper retired, the light ______ automatically for twenty years.',
      ok: 'had been running',
      w: ['has been running', 'was running', 'ran'],
    },
    {
      p: 'When the survey ended, the team ______ for eleven months.',
      ok: 'had been working',
      w: ['has been working', 'was working', 'worked'],
    },
    {
      p: 'By 1930, the mill ______ at full capacity for a decade.',
      ok: 'had been operating',
      w: ['has been operating', 'was operating', 'operated'],
    },
  ]
);

/* ---------------- perfect tenses ---------------- */

frame(
  'PF-1',
  SK.PF,
  'easy',
  'The mill closed for good in 1930 after more than a century of operation.',
  '"By" plus a past date sets a deadline in the past, so the earlier action takes "had".',
  [
    'uses the present perfect with a deadline that has already passed',
    'uses the simple past where the earlier of two past actions needs the past perfect',
    'uses a progressive form that does not express completion',
  ],
  [
    { p: 'By 1900, the mill ______ for sixty years.', ok: 'had operated', w: ['has operated', 'operated', 'was operating'] },
    {
      p: 'By the time the survey ended, the team ______ three thousand photographs.',
      ok: 'had taken',
      w: ['has taken', 'took', 'was taking'],
    },
    { p: 'By 1950, the harbor ______ more than half its shipping.', ok: 'had lost', w: ['has lost', 'lost', 'was losing'] },
  ]
);

frame(
  'PF-2',
  SK.PF,
  'medium',
  'The site has been studied continuously for a decade by two separate research teams.',
  '"Since" plus a starting point calls for the present perfect.',
  [
    'uses the simple past with "since", which needs a perfect tense',
    'uses the past perfect even though the action continues into the present',
    'uses a progressive form that does not express the accumulated result',
  ],
  [
    {
      p: 'The researchers ______ the same site since 2015.',
      ok: 'have studied',
      w: ['studied', 'had studied', 'are studying'],
    },
    {
      p: 'The museum ______ the ledger since the fire.',
      ok: 'has stored',
      w: ['stored', 'had stored', 'is storing'],
    },
    { p: 'The log ______ in the family since 1890.', ok: 'has remained', w: ['remained', 'had remained', 'is remaining'] },
  ]
);

frame(
  'PF-3',
  SK.PF,
  'hard',
  'The bridge is scheduled to be repainted in 2031, a century after it opened.',
  'A future deadline takes the future perfect, not the simple future.',
  [
    'uses the simple future, which does not express completion before the deadline',
    'uses the present perfect with a future deadline',
    'uses the simple past with a future deadline',
  ],
  [
    {
      p: 'By next June, the bridge ______ for a century.',
      ok: 'will have stood',
      w: ['will stand', 'has stood', 'stood'],
    },
    {
      p: 'By the end of the project, the team ______ every site on the coast.',
      ok: 'will have surveyed',
      w: ['will survey', 'has surveyed', 'surveyed'],
    },
    {
      p: 'By the time the ferry returns, the crew ______ the deck twice.',
      ok: 'will have painted',
      w: ['will paint', 'has painted', 'painted'],
    },
  ]
);

frame(
  'PF-4',
  SK.PF,
  'very_hard',
  'The fresco was rediscovered in 1962, behind a wall that had been added in 1701.',
  'A past deadline with a passive verb still takes the past perfect: had been plus the past participle.',
  [
    'uses the present perfect passive with a deadline in the past',
    'uses the simple past passive, which loses the sense of an action completed earlier',
    'uses the present passive with a past deadline',
  ],
  [
    {
      p: 'By the time the restoration began, the fresco ______ for decades.',
      ok: 'had been neglected',
      w: ['has been neglected', 'was neglected', 'is neglected'],
    },
    {
      p: 'By 1900, the channel ______ twice in fifty years.',
      ok: 'had been dredged',
      w: ['has been dredged', 'was dredged', 'is dredged'],
    },
    {
      p: 'By the time the survey ended, the site ______ by three separate teams.',
      ok: 'had been mapped',
      w: ['has been mapped', 'was mapped', 'is mapped'],
    },
  ]
);

/* ---------------- subjunctive ---------------- */

frame(
  'SUB-1',
  SK.SUB,
  'easy',
  'The ferry schedule depends on the tide and changes with the season.',
  'A condition that is contrary to fact takes "were" for every subject.',
  [
    'uses the indicative "was" in a contrary-to-fact condition',
    'uses the present tense in a hypothetical condition',
    'uses the base form without a "that" clause to license it',
  ],
  [
    {
      p: 'If the harbor ______ deeper, the ferry could dock at low tide.',
      ok: 'were',
      w: ['was', 'is', 'be'],
    },
    {
      p: 'If she ______ the director, she would open the archive to the public.',
      ok: 'were',
      w: ['was', 'is', 'be'],
    },
    { p: 'If the map ______ accurate, the route would be shorter.', ok: 'were', w: ['was', 'is', 'be'] },
  ]
);

frame(
  'SUB-2',
  SK.SUB,
  'medium',
  'The painting had been reframed twice before the museum acquired it in 1988.',
  'A request or demand after "that" takes the base form, whatever the subject.',
  [
    'uses the indicative present after a demand',
    'uses the past indicative after a demand',
    'uses the future after a demand',
  ],
  [
    {
      p: 'The curator asked that the painting ______ returned to its original frame.',
      ok: 'be',
      w: ['is', 'was', 'will be'],
    },
    {
      p: 'The board recommended that the bridge ______ closed for inspection.',
      ok: 'be',
      w: ['is', 'was', 'will be'],
    },
    {
      p: 'The committee requires that every object ______ photographed before it moves.',
      ok: 'be',
      w: ['is', 'was', 'will be'],
    },
  ]
);

frame(
  'SUB-3',
  SK.SUB,
  'hard',
  'The gallery hangs work at eye level as a matter of policy.',
  'The base form after "that" has no -s even when the subject is singular.',
  [
    'uses the indicative present after a demand',
    'uses the past indicative after a demand',
    'uses the future after a demand',
  ],
  [
    {
      p: 'The director insisted that the work ______ hung at eye level.',
      ok: 'be',
      w: ['is', 'was', 'will be'],
    },
    { p: 'The rules require that each visitor ______ a badge.', ok: 'wear', w: ['wears', 'wore', 'will wear'] },
    {
      p: 'The board requested that the report ______ before the meeting.',
      ok: 'be finished',
      w: ['is finished', 'was finished', 'will finish'],
    },
  ]
);

frame(
  'SUB-4',
  SK.SUB,
  'very_hard',
  'The terms of the gift are unusually strict and have been enforced before.',
  'A subjunctive condition can drop "if" and invert: Were ..., Had ..., Should ....',
  [
    'uses a base form where the inverted construction needs a past participle',
    'uses a participle where the inverted construction needs a past participle',
    'uses an infinitive where the inverted construction needs a past participle',
  ],
  [
    {
      p: 'Were the collection ______ to another city, the terms of the gift would be violated.',
      ok: 'moved',
      w: ['move', 'moving', 'to move'],
    },
    {
      p: 'Had the harbor ______ deeper, the ferry could have docked.',
      ok: 'been',
      w: ['be', 'being', 'to be'],
    },
    {
      p: 'Had the survey ______ earlier, the storm would not have mattered.',
      ok: 'begun',
      w: ['begin', 'beginning', 'to begin'],
    },
  ]
);

frame(
  'SUB-5',
  SK.SUB,
  'extreme',
  'The frame arrived two weeks after the painting and did not match the catalog.',
  'A negative subjunctive demand puts "not" before the base form, not after an auxiliary.',
  [
    'uses the indicative present in a negative subjunctive demand',
    'uses a past or progressive form where the base form is required',
    'uses a participle where the base form is required',
  ],
  [
    {
      p: 'The curator insisted that the painting not ______ until the frame arrived.',
      ok: 'be hung',
      w: ['is hung', 'was hung', 'being hung'],
    },
    {
      p: 'The board asked that the report ______ before the vote.',
      ok: 'be circulated',
      w: ['is circulated', 'was circulated', 'circulating'],
    },
    {
      p: 'It is essential that every visitor ______ the rules before entering.',
      ok: 'read',
      w: ['reads', 'was reading', 'being read'],
    },
  ]
);

/* ---------------- parallelism in a series ---------------- */

frame(
  'PAR-1',
  SK.PAR,
  'easy',
  'The workshop runs for six weekends each spring and draws students from three counties.',
  'The first item sets the pattern; every later item must match it.',
  [
    'switches the item to a gerund while the other items keep their original form',
    'switches the item to an infinitive while the other items keep their original form',
    'switches the item to a different part of speech from the other items',
  ],
  [
    {
      p: 'The workshop teaches students how to mix glazes, ______, and fire a kiln.',
      ok: 'throw a pot',
      w: ['throwing a pot', 'to throw a pot', 'pot throwing'],
    },
    {
      p: 'The job requires patience, accuracy, and ______.',
      ok: 'attention to detail',
      w: ['attending to detail', 'to attend to detail', 'attentive to detail'],
    },
    {
      p: 'The report was clear, concise, and ______.',
      ok: 'well organized',
      w: ['organizing', 'to organize', 'organization'],
    },
  ]
);

frame(
  'PAR-2',
  SK.PAR,
  'medium',
  'The team spent three weeks at the estuary and returned with more than forty samples.',
  'Three past-tense verbs in a row must all be past tense.',
  [
    'uses a participle where the other items are finite past-tense verbs',
    'uses an infinitive where the other items are finite past-tense verbs',
    'uses a noun phrase where the other items are verbs',
  ],
  [
    {
      p: 'The team measured the depth, recorded the salinity, and ______ samples.',
      ok: 'collected',
      w: ['collecting', 'to collect', 'collection of'],
    },
    {
      p: 'The keeper trimmed the wick, cleaned the lens, and ______ the shutters.',
      ok: 'opened',
      w: ['opening', 'to open', 'opening of'],
    },
    {
      p: 'The volunteers counted the nests, marked the dunes, and ______ the signs.',
      ok: 'replaced',
      w: ['replacing', 'to replace', 'replacement of'],
    },
  ]
);

frame(
  'PAR-3',
  SK.PAR,
  'hard',
  'The proposal has been under review since March and has already been revised twice.',
  'Long items make it easy to lose the pattern; check the form of each item against the first.',
  [
    'switches the item to a different grammatical form from the one the series establishes',
    'switches the item to an infinitive, breaking the series pattern',
    'switches the item to a form that does not match the other items',
  ],
  [
    {
      p: 'The proposal calls for widening the channel, rebuilding the docks, and ______ the ferry schedule.',
      ok: 'revising',
      w: ['revise', 'to revise', 'revision of'],
    },
    {
      p: 'The job demands an eye for detail, a steady hand, and ______.',
      ok: 'a tolerance for repetition',
      w: ['tolerating repetition', 'to tolerate repetition', 'tolerate repetition'],
    },
    {
      p: 'The lecture was praised for its clarity, its brevity, and ______.',
      ok: 'its accuracy',
      w: ['being accurate', 'to be accurate', 'accurate'],
    },
  ]
);

frame(
  'PAR-4',
  SK.PAR,
  'very_hard',
  'The plan has been debated for two years.',
  'When the items are whole clauses, each clause needs its own subject and verb in the same form.',
  [
    'switches from a full clause to a participial phrase',
    'switches from a full clause to an infinitive phrase',
    'switches from a full clause to a noun phrase',
  ],
  [
    {
      p: 'The plan promises that the channel will be widened, that the docks will be rebuilt, and that ______.',
      ok: 'the ferry schedule will be revised',
      w: ['revising the ferry schedule', 'to revise the ferry schedule', 'the revising of the ferry schedule'],
    },
    {
      p: 'The report argues that the harbor has silted up, that the docks have rotted, and that ______.',
      ok: 'the ferry has lost its route',
      w: ['the ferry losing its route', 'for the ferry to lose its route', 'the loss of the ferry route'],
    },
    {
      p: 'The museum asks that visitors sign in, that they leave large bags at the desk, and that ______.',
      ok: 'they silence their phones',
      w: ['silencing their phones', 'to silence their phones', 'phones being silenced'],
    },
  ]
);

frame(
  'PAR-5',
  SK.PAR,
  'extreme',
  'The proposal has been praised by both reviewers.',
  'Repeated prepositions and repeated relative clauses must stay identical in form across all items.',
  [
    'replaces the clause with a noun phrase',
    'replaces the clause with an infinitive',
    'replaces the clause with an independent clause',
  ],
  [
    {
      p: 'The proposal was praised for being affordable, for being durable, and for ______.',
      ok: 'being reversible',
      w: ['reversibility', 'to be reversible', 'it is reversible'],
    },
    {
      p: 'The job requires that the applicant read charts, that the applicant keep a log, and that the applicant ______ alone for weeks.',
      ok: 'work',
      w: ['a worker', 'to work', 'it works'],
    },
    {
      p: 'The foundation supports research that is ambitious, research that is risky, and research that ______.',
      ok: 'is unglamorous',
      w: ['the unglamorous kind', 'to be unglamorous', 'it is unglamorous'],
    },
  ]
);

/* ---------------- parallel correlatives ---------------- */

frame(
  'NB-1',
  SK.NB,
  'easy',
  'The fresco was cleaned over eighteen months by a team of four conservators.',
  '"Not only" must be followed by the same kind of structure as "but also".',
  [
    'switches to a gerund, which does not match the structure on the other side of the pair',
    'switches to an infinitive, which does not match the structure on the other side of the pair',
    'switches to a form that does not match the structure on the other side of the pair',
  ],
  [
    {
      p: 'The restoration not only ______ but also doubled attendance.',
      ok: 'preserved the fresco',
      w: ['preserving the fresco', 'to preserve the fresco', 'preservation of the fresco'],
    },
    {
      p: 'The grant will support not only the survey but also ______.',
      ok: "the laboratory's equipment",
      w: ['equipping the laboratory', 'to equip the laboratory', 'equip the laboratory'],
    },
    {
      p: 'She was not only a careful editor but also ______.',
      ok: 'a gifted translator',
      w: ['translating well', 'to translate', 'translation'],
    },
  ]
);

frame(
  'NB-2',
  SK.NB,
  'medium',
  'The new wing opens to the public in June after eighteen months of construction.',
  'Both halves of "not only ... but also" must be built the same way.',
  [
    'switches to a gerund, which does not match the structure on the other side of the pair',
    'switches to an infinitive, which does not match the structure on the other side of the pair',
    'switches to a form that does not match the structure on the other side of the pair',
  ],
  [
    {
      p: 'The new wing not only houses the glass collection but also ______ the ceramics.',
      ok: 'displays',
      w: ['displaying', 'to display', 'display of'],
    },
    {
      p: 'The campaign not only raised money but also ______ public attention.',
      ok: 'attracted',
      w: ['attracting', 'to attract', 'attraction of'],
    },
    {
      p: 'The course teaches not only how to read a chart but also ______.',
      ok: 'how to plot a course',
      w: ['plotting a course', 'to plot a course', 'the plotting of a course'],
    },
  ]
);

frame(
  'NB-3',
  SK.NB,
  'hard',
  'The design was revised after the first winter, when the heating bills arrived.',
  'The element after "but also" must match the element after "not only", not the whole sentence.',
  [
    'switches to a gerund, which does not match the structure on the other side of the pair',
    'switches to an infinitive, which does not match the structure on the other side of the pair',
    'switches to a form that does not match the structure on the other side of the pair',
  ],
  [
    {
      p: 'The design not only reduces heat loss but also ______.',
      ok: 'cuts noise',
      w: ['cutting noise', 'to cut noise', 'a cut in noise'],
    },
    {
      p: 'The foundation supports not only fieldwork but also ______.',
      ok: 'the publication of results',
      w: ['publishing results', 'to publish results', 'publish results'],
    },
    {
      p: 'The revision not only clarified the rules but also ______.',
      ok: 'shortened the form',
      w: ['shortening the form', 'to shorten the form', 'a shorter form'],
    },
  ]
);

frame(
  'NB-4',
  SK.NB,
  'extreme',
  'The county has not decided how to fund the work or when to begin it.',
  'Either ... or, neither ... nor, and not only ... but also are fixed pairs; the partner word cannot be swapped.',
  [
    'uses the wrong partner word for the first half of the pair',
    'substitutes a simple conjunction for the second half of the pair',
    'breaks the pair by using a conjunction that does not match the opener',
  ],
  [
    {
      p: 'The plan will either reduce traffic ______ shift it to the side streets.',
      ok: 'or',
      w: ['nor', 'and', 'but'],
    },
    {
      p: 'Neither the county ______ the state has funded the survey.',
      ok: 'nor',
      w: ['or', 'and', 'but'],
    },
    { p: 'The lecture was neither long ______ dull.', ok: 'nor', w: ['or', 'and', 'but'] },
  ]
);

/* ---------------- dangling and misplaced modifiers ---------------- */

frame(
  'MOD-1',
  SK.MOD,
  'easy',
  'The museum opened a new gallery last spring in the oldest part of the building.',
  'The subject right after the comma must be the thing the opening phrase describes.',
  [
    'leaves the opening modifier with nothing it can describe, because the subject that follows is the wrong thing',
    'makes the modifier describe an abstraction instead of the person who performed the action',
    'attaches the modifier to an expletive construction with no agent',
  ],
  [
    {
      p: 'Walking through the exhibit, ______',
      ok: 'visitors noticed the faded tapestry.',
      w: ["the faded tapestry caught visitors' attention.", "the tapestry's colors seemed faded.", 'there was a faded tapestry.'],
    },
    {
      p: 'Having studied the tide tables for years, ______',
      ok: 'the keeper predicted the surge.',
      w: [
        'the surge was predicted by the keeper.',
        'prediction of the surge came easily.',
        'there was a prediction of the surge.',
      ],
    },
    {
      p: 'Covered in dust after decades in storage, ______',
      ok: 'the painting still showed its original colors.',
      w: [
        'the curator cleaned the painting.',
        'the storage room held the painting.',
        'cleaning the painting took a week.',
      ],
    },
  ]
);

frame(
  'MOD-2',
  SK.MOD,
  'medium',
  'The estuary is sampled every June by a team from the state marine laboratory.',
  'A passive main clause usually dangles, because its subject did not perform the opening action.',
  [
    'turns the main clause passive, so the subject cannot be the one performing the opening action',
    'replaces the agent with an abstract noun that cannot perform the action',
    'uses an expletive construction that supplies no subject for the modifier',
  ],
  [
    {
      p: 'To measure the salinity, ______',
      ok: 'the team lowered a probe through the ice.',
      w: ['a probe was lowered through the ice.', 'the ice was drilled by the team.', 'there was a probe in the ice.'],
    },
    {
      p: 'After reading the survey, ______',
      ok: 'the council approved the plan.',
      w: ['the plan was approved by the council.', 'approval of the plan came quickly.', 'there was approval of the plan.'],
    },
    {
      p: 'While cataloguing the letters, ______',
      ok: 'the archivist found a photograph.',
      w: [
        'a photograph was found in the letters.',
        'the letters contained a photograph.',
        'a photograph appeared among the letters.',
      ],
    },
  ]
);

frame(
  'MOD-3',
  SK.MOD,
  'hard',
  'The note was found behind a loose panel during the renovation of the east gallery.',
  'A past-participle opener describes the subject that follows, not the person who found it.',
  [
    'supplies a subject that the participle cannot describe',
    'supplies a subject that the participle cannot describe',
    'uses an expletive construction so the modifier has nothing to attach to',
  ],
  [
    {
      p: 'Written in pencil on the back of a chart, ______',
      ok: 'the note describes the wreck.',
      w: ['the archivist found the note.', "the note's discovery was accidental.", 'there was a note on the chart.'],
    },
    {
      p: 'Trained as a botanist, ______',
      ok: 'she collected grasses wherever she travelled.',
      w: ['her collection of grasses grew quickly.', 'grasses filled her collection.', 'there were grasses in every box.'],
    },
    {
      p: 'Having spent two winters in the Antarctic, ______',
      ok: 'the photographer knew how to work in the cold.',
      w: [
        'the cold was familiar to the photographer.',
        'the photographs show the cold clearly.',
        'there was little the photographer feared.',
      ],
    },
  ]
);

/* ---------------- as ... as ---------------- */

frame(
  'AS-1',
  SK.AS,
  'easy',
  'The old bridge still carries traffic between the two halves of the county.',
  'An equal comparison uses "as" on both sides; "than" signals an inequality.',
  [
    'uses "than", which belongs to a comparison of inequality',
    'uses "like" to introduce a full clause',
    'substitutes a word that cannot complete an as ... as comparison',
  ],
  [
    { p: 'The new bridge is as long ______ the old one.', ok: 'as', w: ['than', 'like', 'so'] },
    { p: 'The second survey was not as thorough ______ the first.', ok: 'as', w: ['than', 'like', 'then'] },
    { p: 'Few instruments are as sensitive ______ this one.', ok: 'as', w: ['than', 'like', 'so'] },
  ]
);

frame(
  'AS-2',
  SK.AS,
  'medium',
  'The harbor has changed a great deal since 1900, when the channel was dredged.',
  'The second "as" introduces the thing compared, even when a whole clause follows.',
  [
    'uses "than" after "as" has already opened the comparison',
    'uses "like" where a conjunction introducing a clause is required',
    'substitutes a word that cannot complete the comparison',
  ],
  [
    { p: 'The harbor is not as deep ______ it was in 1900.', ok: 'as', w: ['than', 'like', 'that'] },
    { p: 'The archive is as well organized ______ any in the state.', ok: 'as', w: ['than', 'like', 'so'] },
    { p: 'The winters here are not as mild ______ they once were.', ok: 'as', w: ['than', 'like', 'then'] },
  ]
);

frame(
  'AS-3',
  SK.AS,
  'hard',
  'The county has built several new crossings since 1950, most of them small.',
  'Multipliers such as "twice" or "half" sit outside the as ... as frame and do not change it.',
  [
    'uses "than" even though the sentence opens with "as many"',
    'uses "like" to introduce the compared clause',
    'substitutes a word that cannot complete the comparison',
  ],
  [
    { p: 'The county has twice as many bridges ______ it had in 1950.', ok: 'as', w: ['than', 'like', 'that'] },
    { p: 'The new lens is not nearly as large ______ the original.', ok: 'as', w: ['than', 'like', 'so'] },
    { p: 'Few harbors on the coast are as busy ______ this one in July.', ok: 'as', w: ['than', 'like', 'so'] },
  ]
);

frame(
  'AS-4',
  SK.AS,
  'very_hard',
  'The gauge was replaced last year after the old one failed during a storm.',
  'A negative equality still takes "as ... as"; "not so ... as" is archaic and the second "as" never becomes "than".',
  [
    'uses "than" in a negative equality',
    'uses "like" before a clause',
    'uses "that" where the second "as" is required',
  ],
  [
    { p: 'The new gauge is not as reliable ______ the one it replaced.', ok: 'as', w: ['than', 'like', 'that'] },
    { p: 'The crossing is not nearly as busy ______ the ferry it replaced.', ok: 'as', w: ['than', 'like', 'that'] },
    { p: 'The archive is as complete ______ any in the state.', ok: 'as', w: ['than', 'like', 'so'] },
  ]
);

/* ---------------- fewer and less ---------------- */

frame(
  'FL-1',
  SK.FL,
  'easy',
  'The estuary has been monitored since 1994 by volunteers working with state biologists.',
  'Count nouns take "fewer"; mass nouns take "less".',
  [
    'uses the quantifier that belongs with an uncountable noun',
    'uses the comparative adjective "lesser" where a quantifier is needed',
    'uses a form that cannot carry the comparison',
  ],
  [
    { p: 'The estuary holds ______ fish than it did a decade ago.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
    { p: 'The region receives ______ rainfall than it did in 1990.', ok: 'less', w: ['fewer', 'lesser', 'little'] },
    { p: 'There are ______ than twenty seats in the hall.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
  ]
);

frame(
  'FL-2',
  SK.FL,
  'medium',
  'Attendance has fallen since the fare increase, according to the museum\'s own count.',
  'Visitors and miles are counted; sugar is measured.',
  [
    'uses the wrong quantifier for the noun',
    'uses "lesser", which means lower in importance, not smaller in amount',
    'uses a form that cannot carry the comparison',
  ],
  [
    { p: 'The museum has ______ visitors this year than last.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
    { p: 'The recipe calls for ______ sugar than the first version.', ok: 'less', w: ['fewer', 'lesser', 'little'] },
    { p: 'The county has ______ miles of trail than it did in 2000.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
  ]
);

frame(
  'FL-3',
  SK.FL,
  'hard',
  'The revised schedule takes effect in September and cuts three morning departures.',
  'Time and money are amounts, but trips and dollars are countable in context; read the noun, not the habit.',
  [
    'uses the wrong quantifier for the noun',
    'uses "lesser" where a plain quantifier is required',
    'uses a form that cannot carry the comparison',
  ],
  [
    { p: 'The new schedule requires ______ stops than the old one.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
    { p: 'The revised plan costs ______ money than the original.', ok: 'less', w: ['fewer', 'lesser', 'little'] },
    { p: 'The county now has ______ than half the rangers it once employed.', ok: 'fewer', w: ['less', 'lesser', 'few'] },
  ]
);

export const formFrames2 = out;
