// Form, Structure, and Sense, part 1: agreement, case, and pronoun reference.
import { o } from '../lib/core.mjs';

const SK = {
  SVA: 'Form: subject-verb agreement with intervening phrases',
  INV: 'Form: inverted subject-verb agreement',
  COL: 'Form: collective nouns',
  IND: 'Form: indefinite pronouns',
  PA: 'Form: pronoun-antecedent agreement',
  PC: 'Form: pronoun case',
  OO: 'Form: one of the ... agreement',
};

const R = {
  SVA: 'A verb agrees with its subject, not with a noun in an intervening phrase such as "along with", "together with", or "as well as".',
  INV: 'When a sentence opens with "there" or with a prepositional phrase, the verb still agrees with the noun that follows it.',
  COL: 'A collective noun such as jury, committee, or flock takes a singular verb when the group acts as a single unit.',
  IND: 'Each, every, either, neither, and one are singular and take singular verbs, even when they are followed by a plural phrase.',
  PA: 'A pronoun must agree in number with its antecedent, and a collective or singular antecedent takes a singular pronoun.',
  PC: 'A pronoun in a compound object takes the object form, and who or whom is chosen by the pronoun\'s role in its own clause.',
  OO: 'In "one of the plural noun who/that ...", the relative pronoun refers to the plural noun, so the verb in the relative clause is plural.',
};

const out = [];

function frame(id, skill, diff, pre, note, notes, items) {
  out.push({ id, skill, diff, pre, note, notes, items });
}

/* ---------------- subject-verb agreement with intervening phrases ---------------- */

frame(
  'SVA-1',
  SK.SVA,
  'easy',
  'The archive received a large donation in 1997.',
  'The head noun before the phrase decides the verb; the noun nearest the blank is a decoy.',
  [
    'makes the verb agree with the plural noun inside the intervening phrase instead of with the singular subject',
    'uses a plural verb form where the subject is singular',
    'changes the tense instead of fixing the agreement',
  ],
  [
    {
      p: 'The collection of letters, along with three diaries, ______ the archive last spring.',
      ok: 'was donated to',
      w: ['were donated to', 'have donated to', 'donate to'],
    },
    {
      p: 'The diary of the last keeper, together with his maps, ______ in the east cabinet.',
      ok: 'sits',
      w: ['sit', 'are sitting', 'have sat'],
    },
    {
      p: 'The box of glass negatives, along with two albums, ______ in the attic for decades.',
      ok: 'remained',
      w: ['remain', 'have remained', 'were remaining'],
    },
  ]
);

frame(
  'SVA-2',
  SK.SVA,
  'medium',
  'Public meetings on the proposal have drawn unusually large crowds since March.',
  '"As well as" and "together with" do not turn a singular subject into a plural one.',
  [
    'treats the phrase introduced by "as well as" as part of a compound subject',
    'uses a plural verb with a singular subject',
    'shifts to a tense or form that the sentence does not call for',
  ],
  [
    {
      p: 'The mayor, as well as the council members, ______ the plan.',
      ok: 'supports',
      w: ['support', 'are supporting', 'have supported'],
    },
    {
      p: 'The report, together with its appendices, ______ more than four hundred pages.',
      ok: 'runs',
      w: ['run', 'are running', 'have run'],
    },
    {
      p: 'The orchestra, accompanied by two guest soloists, ______ on Friday.',
      ok: 'performs',
      w: ['perform', 'are performing', 'have performed'],
    },
  ]
);

frame(
  'SVA-3',
  SK.SVA,
  'hard',
  'Surveyors have measured the site three times since 1998.',
  'A long prepositional chain and a relative clause sit between the subject and the verb; find the head noun first.',
  [
    'lets the verb agree with the nearest plural noun rather than the head noun of the subject',
    'uses a plural verb although the subject is singular',
    'uses a verb form that does not fit the time frame the sentence establishes',
  ],
  [
    {
      p: 'The gap between the two ridges, which surveyors measured twice, ______ about nine meters.',
      ok: 'is',
      w: ['are', 'were', 'have been'],
    },
    {
      p: 'The number of birds nesting on the island, according to the latest count, ______ by half since 1990.',
      ok: 'has fallen',
      w: ['have fallen', 'are falling', 'fall'],
    },
    {
      p: 'The cost of the repairs, including the new bearings, ______ more than the county expected.',
      ok: 'was',
      w: ['were', 'have been', 'are'],
    },
  ]
);

frame(
  'SVA-4',
  SK.SVA,
  'very_hard',
  'Engineers still argue about how the original span was built.',
  'Two interruptions stack up here: an appositive phrase and a relative clause. Neither changes the number of the subject.',
  [
    'agrees with the plural noun inside the relative clause instead of with the singular subject',
    'uses a plural verb with a singular subject',
    'uses a plural verb form with a singular head noun',
  ],
  [
    {
      p: 'The pattern of tides recorded in the log, together with the notes the keeper added during storms, ______ the basis for the current model.',
      ok: 'forms',
      w: ['form', 'are forming', 'have formed'],
    },
    {
      p: 'The history of the two lighthouses, which the society published last year, ______ three hundred pages.',
      ok: 'fills',
      w: ['fill', 'are filling', 'have filled'],
    },
    {
      p: 'The question of how the stones were moved, along with several related puzzles, ______ the book\'s central chapter.',
      ok: 'occupies',
      w: ['occupy', 'are occupying', 'have occupied'],
    },
  ]
);

frame(
  'SVA-5',
  SK.SVA,
  'extreme',
  'Few records survive from the first decade of the station.',
  'The subject is a singular noun followed by two separate modifiers, one of them plural.',
  [
    'takes the plural of the nearer modifier as the subject',
    'mistakes the plural noun inside the modifier for the head noun',
    'uses a plural verb with a singular subject',
  ],
  [
    {
      p: 'The log kept by the three keepers who staffed the station before 1900 ______ the only record of the winter.',
      ok: 'remains',
      w: ['remain', 'are remaining', 'have remained'],
    },
    {
      p: 'The map of the channels that shift with every storm ______ the surveyors\' best guess at the time.',
      ok: 'represents',
      w: ['represent', 'are representing', 'have represented'],
    },
    {
      p: 'The account of the two wrecks that the keeper witnessed ______ fewer than four pages.',
      ok: 'covers',
      w: ['cover', 'are covering', 'have covered'],
    },
  ]
);

/* ---------------- inverted agreement ---------------- */

frame(
  'INV-1',
  SK.INV,
  'easy',
  'The county has delayed its decision on the new ferry terminal twice since March.',
  'The noun that follows "there" is the real subject, so read past the blank before choosing.',
  [
    'agrees with a noun other than the one that follows the verb',
    'uses a singular verb where the delayed subject is plural',
    'uses a singular perfect form where the delayed subject is plural',
  ],
  [
    { p: 'There ______ several reasons for the delay.', ok: 'are', w: ['is', 'was', 'has been'] },
    { p: 'There ______ a single copy of the map in the archive.', ok: 'is', w: ['are', 'were', 'have been'] },
    { p: 'There ______ two entrances on the north side.', ok: 'are', w: ['is', 'has been', 'was'] },
  ]
);

frame(
  'INV-2',
  SK.INV,
  'medium',
  'The gallery reopened in May after a two-year renovation of the east wing.',
  'A fronted prepositional phrase pushes the subject after the verb; the subject still controls the verb.',
  [
    'agrees with the singular noun inside the fronted phrase instead of with the subject that follows',
    'uses a singular verb with a plural subject',
    'uses a progressive form where a simple present is required',
  ],
  [
    {
      p: 'Along the north wall ______ a series of small paintings.',
      ok: 'hangs',
      w: ['hang', 'are hanging', 'have hung'],
    },
    {
      p: 'At the far end of the gallery ______ three glass cases.',
      ok: 'stand',
      w: ['stands', 'is standing', 'has stood'],
    },
    {
      p: 'Beneath the dome ______ the original instrument and its case.',
      ok: 'sit',
      w: ['sits', 'is sitting', 'has sat'],
    },
  ]
);

frame(
  'INV-3',
  SK.INV,
  'hard',
  'The papers were stored in the attic for sixty years before anyone opened them.',
  'Inversion plus a delayed subject is the trap; match the verb to the noun after it.',
  [
    'uses a plural verb when the delayed subject is singular',
    'uses a singular verb when the delayed subject is plural',
    'uses a perfect form that does not agree with the delayed subject',
  ],
  [
    {
      p: 'Among the papers ______ a single letter from the architect.',
      ok: 'was',
      w: ['were', 'have been', 'are'],
    },
    {
      p: 'In the corner of the workshop ______ the tools the carpenter used for forty years.',
      ok: 'hang',
      w: ['hangs', 'is hanging', 'has hung'],
    },
    {
      p: 'On the reverse of the canvas ______ two sketches in charcoal.',
      ok: 'are',
      w: ['is', 'was', 'has been'],
    },
  ]
);

frame(
  'INV-4',
  SK.INV,
  'very_hard',
  'The exhibit fills the entire west wing of the building and runs through June.',
  'Two nouns follow the verb; the first one is the subject, and a phrase then modifies it.',
  [
    'agrees with the noun inside the modifying phrase rather than with the subject',
    'uses a plural verb with a singular subject',
    'uses a progressive form that the sentence does not call for',
  ],
  [
    {
      p: 'There ______ a catalogue of the paintings, along with three essays, at the entrance.',
      ok: 'is',
      w: ['are', 'were', 'have been'],
    },
    {
      p: 'There ______ several crates of glass negatives in the basement.',
      ok: 'are',
      w: ['is', 'was', 'has been'],
    },
    {
      p: 'In the first room ______ a portrait of the founder and his two sons.',
      ok: 'hangs',
      w: ['hang', 'are hanging', 'have hung'],
    },
  ]
);

/* ---------------- collective nouns ---------------- */

frame(
  'COL-1',
  SK.COL,
  'easy',
  'The trial drew attention from newspapers across the state and lasted nine days.',
  'A collective noun acting as one body takes a singular verb in American English.',
  [
    'treats the collective noun as a plural and uses a plural verb',
    'uses a participle where a finite verb is needed',
    'uses a plural past form with a singular collective subject',
  ],
  [
    {
      p: 'The jury ______ reached a verdict after two days.',
      ok: 'has',
      w: ['have', 'having', 'were'],
    },
    {
      p: 'The committee ______ its decision last week.',
      ok: 'announced',
      w: ['announce', 'have announced', 'were announcing'],
    },
    {
      p: 'The flock ______ south each October.',
      ok: 'flies',
      w: ['fly', 'are flying', 'have flown'],
    },
  ]
);

frame(
  'COL-2',
  SK.COL,
  'medium',
  'The meeting ran long and the vote was postponed until the following Tuesday.',
  'A phrase between the collective noun and its verb does not make the group plural.',
  [
    'agrees with the plural noun in the interrupting phrase instead of with the collective subject',
    'uses a plural verb with a collective noun acting as one unit',
    'uses a progressive form where a simple tense is correct',
  ],
  [
    {
      p: 'The committee, after two hours of debate, ______ to postpone the vote.',
      ok: 'decided',
      w: ['decide', 'have decided', 'were deciding'],
    },
    {
      p: 'The jury, which heard four days of testimony, ______ still undecided.',
      ok: 'is',
      w: ['are', 'were', 'have been'],
    },
    {
      p: 'The audience, packed into the hall, ______ at the end of the second act.',
      ok: 'rose',
      w: ['rise', 'have risen', 'were rising'],
    },
  ]
);

frame(
  'COL-3',
  SK.COL,
  'hard',
  'The station runs on a fixed annual budget that the county reviews each June.',
  'A comparison phrase sits between the collective noun and its verb; the comparison does not change the number.',
  [
    'lets the plural noun in the comparison control the verb',
    'uses a plural verb with a collective subject',
    'uses a verb form that does not agree with the singular pronoun',
  ],
  [
    {
      p: 'The team, like the crew before it, ______ its equipment at the end of each season.',
      ok: 'inspects',
      w: ['inspect', 'are inspecting', 'have inspected'],
    },
    {
      p: 'The staff, unlike the volunteers, ______ a full background check.',
      ok: 'requires',
      w: ['require', 'are requiring', 'have required'],
    },
    {
      p: 'The orchestra, like most groups its size, ______ on ticket sales.',
      ok: 'depends',
      w: ['depend', 'are depending', 'have depended'],
    },
  ]
);

frame(
  'COL-4',
  SK.COL,
  'very_hard',
  'The county has funded the survey every year since 2009 without debate.',
  'A collective noun followed by a plural of-phrase still takes a singular verb when the group acts as one body.',
  [
    'agrees with the plural noun after "of" rather than with the collective subject',
    'uses a plural verb with a collective noun acting as a unit',
    'uses a plural form of a verb that needs to be singular here',
  ],
  [
    {
      p: 'The board of trustees ______ the budget at its March meeting.',
      ok: 'approves',
      w: ['approve', 'are approving', 'have approved'],
    },
    {
      p: 'The panel of experts ______ its report in June.',
      ok: 'releases',
      w: ['release', 'are releasing', 'have released'],
    },
    {
      p: 'The crew of the ferry ______ trained for the new route since January.',
      ok: 'has been',
      w: ['have been', 'are', 'were'],
    },
  ]
);

/* ---------------- indefinite pronouns ---------------- */

frame(
  'IND-1',
  SK.IND,
  'easy',
  'The fire destroyed most of the west wing and much of the paper collection.',
  'Each, every, either, neither, and one are grammatically singular no matter what follows them.',
  [
    'agrees with the plural noun after "of" instead of with the singular pronoun',
    'uses a plural verb with a singular indefinite pronoun',
    'uses a verb form that does not agree with the singular pronoun',
  ],
  [
    {
      p: 'Each of the samples ______ catalogued before the fire.',
      ok: 'was',
      w: ['were', 'have been', 'are'],
    },
    { p: 'Every one of the letters ______ dated.', ok: 'is', w: ['are', 'were', 'have been'] },
    {
      p: 'Neither of the proposals ______ the budget.',
      ok: 'meets',
      w: ['meet', 'are meeting', 'have met'],
    },
  ]
);

frame(
  'IND-2',
  SK.IND,
  'medium',
  'The building reopened in June after a renovation that lasted almost two years.',
  'The plural noun after "of" is a decoy; the pronoun before it is the subject.',
  [
    'takes the plural noun in the "of" phrase as the subject',
    'uses a plural verb with a singular indefinite pronoun',
    'uses a progressive form that the sentence does not support',
  ],
  [
    {
      p: 'Each of the galleries ______ its own climate control.',
      ok: 'has',
      w: ['have', 'are having', 'were having'],
    },
    {
      p: 'Neither of the two bridges ______ wide enough for the new trucks.',
      ok: 'is',
      w: ['are', 'were', 'have been'],
    },
    {
      p: 'One of the windows ______ been replaced since the storm.',
      ok: 'has',
      w: ['have', 'are', 'were'],
    },
  ]
);

frame(
  'IND-3',
  SK.IND,
  'hard',
  'The storm knocked out power along the whole coast for the better part of a week.',
  '"None" with a mass noun such as equipment is singular, and "every one" is always singular.',
  [
    'uses a plural verb even though the noun after "of" is a mass noun',
    'agrees with the plural noun that follows instead of with the singular pronoun',
    'uses a plural past form with a singular subject',
  ],
  [
    {
      p: 'None of the equipment ______ working after the storm.',
      ok: 'was',
      w: ['were', 'have been', 'are'],
    },
    {
      p: 'Every one of the paintings in the east gallery ______ a separate label.',
      ok: 'needs',
      w: ['need', 'are needing', 'have needed'],
    },
    {
      p: 'Neither of the students who signed up ______ submitted the form.',
      ok: 'has',
      w: ['have', 'are', 'were'],
    },
  ]
);

frame(
  'IND-4',
  SK.IND,
  'extreme',
  'The ledger has been missing from the archive since the fire of 1974.',
  'With "neither ... nor", the verb agrees with the subject nearer to it.',
  [
    'agrees with the first subject rather than the nearer one',
    'uses a plural verb although the nearer subject is singular',
    'uses a plural perfect form where a singular past is required',
  ],
  [
    {
      p: 'Neither the curator nor the archivist ______ able to locate the missing ledger.',
      ok: 'was',
      w: ['were', 'have been', 'are'],
    },
    {
      p: 'Neither the maps nor the diary ______ the answer.',
      ok: 'provides',
      w: ['provide', 'are providing', 'have provided'],
    },
    {
      p: 'Neither of the two keys ______ the lock.',
      ok: 'opens',
      w: ['open', 'are opening', 'have opened'],
    },
  ]
);

/* ---------------- pronoun-antecedent agreement ---------------- */

frame(
  'PA-1',
  SK.PA,
  'easy',
  'The company has grown quickly since 2015 and now employs about four hundred people.',
  'Match the pronoun to the noun it replaces, not to the noun nearest it.',
  [
    'uses a pronoun that does not agree with its antecedent',
    'uses the contraction of "it is" where a possessive is needed',
    'uses a homophone of the possessive',
  ],
  [
    {
      p: 'The company moved ______ headquarters to a converted mill.',
      ok: 'its',
      w: ['their', "it's", "they're"],
    },
    {
      p: 'Each of the galleries has ______ own climate control.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
    {
      p: 'The teams submitted ______ reports in March.',
      ok: 'their',
      w: ['its', "it's", 'there'],
    },
  ]
);

frame(
  'PA-2',
  SK.PA,
  'medium',
  'The museum reopened in May after a long closure and a change of directors.',
  'An intervening phrase or a compound subject decides which pronoun is right.',
  [
    'uses a pronoun that does not agree with its antecedent',
    'uses a contraction where a possessive is required',
    'uses a form that cannot serve as the required possessive',
  ],
  [
    {
      p: 'The museum, which reopened in May, has extended ______ hours.',
      ok: 'its',
      w: ['their', "it's", "its'"],
    },
    {
      p: 'The panel of judges announced ______ decision on Friday.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
    {
      p: 'The orchestra and its conductor took ______ places on stage.',
      ok: 'their',
      w: ['its', "they're", 'there'],
    },
  ]
);

frame(
  'PA-3',
  SK.PA,
  'hard',
  'Every object in the collection has been photographed and measured by the staff.',
  'Singular antecedents with "each" or "every" take singular pronouns even when a plural noun follows.',
  [
    'uses a pronoun that does not agree with its antecedent',
    'uses a contraction where a possessive is required',
    'uses a form that cannot serve as the required possessive',
  ],
  [
    {
      p: 'Every object in the collection has ______ own catalog number.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
    {
      p: 'The two foundations pooled ______ resources for the survey.',
      ok: 'their',
      w: ['its', "they're", 'there'],
    },
    {
      p: 'A city that ignores ______ waterfront eventually pays for it.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
  ]
);

frame(
  'PA-4',
  SK.PA,
  'extreme',
  'The archive holds letters from three generations of keepers and their families.',
  'A collective antecedent acting as a unit takes a singular pronoun, even when the sentence goes on to mention members.',
  [
    'uses a pronoun that does not agree with its antecedent',
    'uses a contraction where a possessive is required',
    'uses a form that cannot serve as the required possessive',
  ],
  [
    {
      p: 'The committee, whose members rarely agree, has published ______ findings.',
      ok: 'its',
      w: ['their', "it's", "its'"],
    },
    {
      p: 'The firm, which employs forty people, moved ______ offices in June.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
    {
      p: 'The crew, some of whom had never sailed, finished ______ training in May.',
      ok: 'its',
      w: ['their', "it's", 'theirs'],
    },
  ]
);

/* ---------------- pronoun case ---------------- */

frame(
  'PC-1',
  SK.PC,
  'easy',
  'The foundation announced its grants in June after a long review of the applications.',
  'After a preposition, a pronoun takes the object form even inside a compound.',
  [
    'uses the subject form of the pronoun after a preposition',
    'uses a reflexive pronoun where the plain object form is required',
    'uses a possessive form where an object pronoun is required',
  ],
  [
    {
      p: 'The committee awarded the grant to my colleague and ______.',
      ok: 'me',
      w: ['I', 'myself', 'mine'],
    },
    {
      p: 'The letter was addressed to the curator and ______.',
      ok: 'me',
      w: ['I', 'myself', 'mine'],
    },
    {
      p: 'Between you and ______, the plan will not work.',
      ok: 'me',
      w: ['I', 'myself', 'mine'],
    },
  ]
);

frame(
  'PC-2',
  SK.PC,
  'medium',
  'The dig has produced more than two thousand objects, most of them fragments of pottery.',
  'Who is the subject of its own clause, so it takes the subject form.',
  [
    'uses the object form where the pronoun is the subject of its clause',
    'uses a pronoun that cannot refer to a person',
    'uses a possessive form where a subject pronoun is needed',
  ],
  [
    {
      p: 'The archaeologist ______ discovered the site received the prize.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
    {
      p: 'The volunteers ______ cleaned the beach were given a tour of the station.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
    {
      p: 'The engineer ______ designed the lock was never credited.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
  ]
);

frame(
  'PC-3',
  SK.PC,
  'hard',
  'The committee interviewed six candidates for the post over the course of two weeks.',
  'Whom is the object of the verb in its own clause, even when the clause opens the sentence.',
  [
    'uses the subject form where the pronoun is the object of a verb',
    'uses a pronoun that cannot refer to a person',
    'uses a possessive form where an object pronoun is required',
  ],
  [
    {
      p: 'The archaeologist ______ the committee chose had never led a dig.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
    {
      p: 'The curator ______ the board hired had worked in three museums.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
    {
      p: 'The witness ______ the inspector questioned gave a written statement.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
  ]
);

frame(
  'PC-4',
  SK.PC,
  'very_hard',
  'The award is given every other year to a researcher working outside the university system.',
  'An inserted "the committee believed" does not change the pronoun\'s role in the clause that follows.',
  [
    'chooses the object form because a reporting clause sits in the middle',
    'chooses the subject form where the pronoun is the object of the following verb',
    'uses a possessive where an object pronoun is required',
  ],
  [
    {
      p: 'The prize went to the researcher ______ the committee believed had done the fieldwork.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
    {
      p: 'The curator ______ the staff suspected had taken the ledger resigned.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
    {
      p: 'The engineer ______ the board assumed had approved the change was never consulted.',
      ok: 'who',
      w: ['whom', 'which', 'whose'],
    },
  ]
);

frame(
  'PC-5',
  SK.PC,
  'extreme',
  'The society has honored its volunteers since 1930 at a dinner each spring.',
  'A comparative clause can leave out words, but the pronoun keeps the case its missing verb would require.',
  [
    'uses the subject form where the verb in the clause takes an object',
    'uses a pronoun that cannot refer to a person',
    'uses a possessive form where an object pronoun is required',
  ],
  [
    {
      p: 'The award went to the keeper ______ the town trusted more than any other.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
    {
      p: 'The survey was completed by the same team ______ the county hired in 2004.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
    {
      p: 'The letters were returned to the family ______ the curator had consulted.',
      ok: 'whom',
      w: ['who', 'which', 'whose'],
    },
  ]
);

/* ---------------- one of the ... agreement ---------------- */

frame(
  'OO-1',
  SK.OO,
  'easy',
  'The east wing is closed for restoration until June.',
  'The relative pronoun refers to the plural noun after "one of", so the verb inside the clause is plural.',
  [
    'makes the verb in the relative clause agree with "one" instead of with the plural noun',
    'uses a progressive form that the sentence does not support',
    'uses a singular perfect form with a plural antecedent',
  ],
  [
    {
      p: 'One of the paintings that ______ in the east wing is being restored.',
      ok: 'hang',
      w: ['hangs', 'is hanging', 'has hung'],
    },
    {
      p: 'One of the letters that ______ in the archive describes the flood.',
      ok: 'survive',
      w: ['survives', 'is surviving', 'has survived'],
    },
    {
      p: 'She is one of the few scholars who ______ the original ledger.',
      ok: 'have read',
      w: ['has read', 'has been reading', 'reads'],
    },
  ]
);

frame(
  'OO-2',
  SK.OO,
  'medium',
  'The river has flooded the lower valley twice since 1990, most recently in March.',
  'Find what "that" or "who" refers to before you choose the verb.',
  [
    'agrees with "one" rather than with the plural noun the relative pronoun refers to',
    'uses a singular verb with a plural relative pronoun',
    'uses a progressive form where a simple present is required',
  ],
  [
    {
      p: 'One of the bridges that ______ the river was built in 1902.',
      ok: 'cross',
      w: ['crosses', 'is crossing', 'has crossed'],
    },
    {
      p: 'One of the species that ______ in the estuary is now protected.',
      ok: 'nest',
      w: ['nests', 'is nesting', 'has nested'],
    },
    {
      p: 'He is one of the volunteers who ______ every spring.',
      ok: 'return',
      w: ['returns', 'is returning', 'has returned'],
    },
  ]
);

frame(
  'OO-3',
  SK.OO,
  'hard',
  'The documents were moved to climate-controlled storage after the roof began to leak.',
  'The relative clause attaches to the plural noun, so its verb is plural even when the main clause verb is singular.',
  [
    'makes the relative clause verb agree with "one" instead of with the plural noun',
    'uses a singular verb where the relative pronoun is plural',
    'uses a singular perfect form with a plural antecedent',
  ],
  [
    {
      p: 'One of the documents that ______ in the case mentions the fire.',
      ok: 'were found',
      w: ['was found', 'is found', 'has been found'],
    },
    {
      p: 'One of the maps that ______ the old channel has been digitized.',
      ok: 'show',
      w: ['shows', 'is showing', 'has shown'],
    },
    {
      p: 'She is one of the few people who ______ the keeper\'s handwriting.',
      ok: 'recognize',
      w: ['recognizes', 'is recognizing', 'has recognized'],
    },
  ]
);

frame(
  'OO-4',
  SK.OO,
  'very_hard',
  'The collection has never been fully catalogued, despite three separate attempts.',
  'A long relative clause can hide the plural noun that controls its verb.',
  [
    'lets "one" control the verb inside the relative clause',
    'uses a singular verb although the relative pronoun refers to a plural noun',
    'uses a singular form where a plural past is required',
  ],
  [
    {
      p: 'One of the crates that ______ in the basement holds the glass negatives.',
      ok: 'were stored',
      w: ['was stored', 'is stored', 'has been stored'],
    },
    {
      p: 'One of the letters that ______ the fire describes the harbor in 1901.',
      ok: 'survived',
      w: ['survives', 'has survived', 'is surviving'],
    },
    {
      p: 'One of the paintings that ______ on the north wall has been sold.',
      ok: 'hang',
      w: ['hangs', 'is hanging', 'has hung'],
    },
  ]
);

frame(
  'OO-5',
  SK.OO,
  'extreme',
  'The survey has been cited in dozens of later studies.',
  'The plural noun may be separated from its relative pronoun by several words; the agreement does not change.',
  [
    'makes the relative verb agree with the singular "one"',
    'uses a singular verb with a plural relative pronoun',
    'uses a singular perfect form where a plural is required',
  ],
  [
    {
      p: 'One of the tide gauges that ______ installed in the 1920s is still in service.',
      ok: 'were',
      w: ['was', 'is', 'has been'],
    },
    {
      p: 'One of the several species that ______ only in this estuary has been listed as rare.',
      ok: 'occur',
      w: ['occurs', 'is occurring', 'has occurred'],
    },
    {
      p: 'He is one of the few engineers who ______ the original drawings.',
      ok: 'have seen',
      w: ['has seen', 'has been seeing', 'sees'],
    },
  ]
);

export const formFrames1 = out;
