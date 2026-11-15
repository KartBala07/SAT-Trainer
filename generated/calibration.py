# -*- coding: utf-8 -*-
"""Post-draft calibration: 12 question rewrites (skill balance) and a final
difficulty pass over all 150 items.

Difficulty is stored as a 150-token sequence aligned to RWP-0001..RWP-0150:
e=easy m=medium h=hard v=very_hard x=extreme. Cross-text items (0121-0150)
skew hard by design.
"""

# id -> replacement fields. Keys must match existing item ids exactly.
REVISIONS = {
"RWP-0009": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"plants eavesdrop\" most nearly means that plants",
 "choices": [
  "release airborne chemicals when their leaves are damaged",
  "detect chemical signals released by other plants and respond to them",
  "attract insects that prey on the caterpillars eating them",
  "compete with their neighbors for the same airborne compounds"],
 "answer": "B",
 "choice_notes": ["this describes the plant that is being eaten, not the one receiving the signal",
                  "correct",
                  "the passage does not describe plants recruiting predators",
                  "no competition for compounds is described"],
 "error_tags": ["concept", "none", "misread", "misread"],
 "explanation": "Eavesdropping means intercepting a signal not addressed to you. The passage's plants detect a neighbor's chemical blend and start producing defenses, which is receiving and acting on another plant's signal. Choice A describes the emitter, and C and D add interactions the passage never mentions.",
 "skill_note": "The metaphor is doing work: eavesdropping is reception, not transmission."},
"RWP-0014": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"It turns back\" most nearly means that the bird",
 "choices": [
  "abandons the crossing rather than attempt it underweight",
  "returns to the same stopover site on later migrations",
  "reverses direction to escape a predator",
  "slows its flight to conserve fat"],
 "answer": "A",
 "choice_notes": ["correct",
                  "later migrations are not discussed",
                  "no predator is mentioned",
                  "the passage explicitly rejects the idea that the bird merely flies slower"],
 "error_tags": ["none", "misread", "misread", "concept"],
 "explanation": "The sentence corrects the expectation that a light bird would fly slower: instead it does not make the attempt. \"Turns back\" therefore means giving up the crossing, not reversing course to escape danger.",
 "skill_note": "The preceding negation (\"does not simply fly slower\") defines the phrase."},
"RWP-0018": {
 "skill": "Command of evidence",
 "stem": "Which finding, if true, would most directly support the proposal that octopus skin senses light independently of the eyes?",
 "choices": [
  "Skin samples taken from the mantle changed color when illuminated, even with no connection to the nervous system.",
  "Octopuses in tanks matched surfaces they could see but not surfaces they could only touch.",
  "Chromatophores are controlled by muscles that respond to signals from the brain.",
  "Octopus skin contains several distinct types of chromatophore pigment."],
 "answer": "A",
 "choice_notes": ["correct",
                  "this supports visual control rather than skin-based sensing",
                  "this describes central control of color change",
                  "pigment variety says nothing about where the light signal is detected"],
 "error_tags": ["none", "concept", "concept", "misread"],
 "explanation": "The proposal requires the skin to detect light without the eyes. Isolated skin that changes color under illumination removes both the eyes and the brain from the pathway, which is direct support. B and C point to visual or central control, and D describes pigments rather than light detection.",
 "skill_note": "The strongest evidence removes the alternative pathway the proposal denies."},
"RWP-0029": {
 "skill": "Command of evidence",
 "stem": "Which finding would most directly support the passage's claim that fertility declines when phosphorus is not replenished?",
 "choices": [
  "Soils on older volcanic islands held less available phosphorus and produced lower crop yields than soils on younger islands.",
  "Volcanic ash soils hold water more tightly than soils derived from granite.",
  "Farmers on volcanic soils apply nitrogen fertilizer more often than farmers elsewhere do.",
  "Fresh volcanic ash contains phosphorus in a form that plants cannot immediately absorb."],
 "answer": "A",
 "choice_notes": ["correct",
                  "this supports the water-retention claim, not the phosphorus one",
                  "nitrogen use does not bear on phosphorus depletion",
                  "this describes the initial state of the ash, not the decline over time"],
 "error_tags": ["none", "misread", "misread", "concept"],
 "explanation": "The claim is that phosphorus supply falls as ash ages, with fertility following. A pairs age with both lower available phosphorus and lower yields. B and C concern other properties, and D describes fresh ash rather than what happens as it weathers.",
 "skill_note": "The evidence must vary the thing the claim says declines: age of the ash."},
"RWP-0033": {
 "skill": "Command of evidence",
 "stem": "Which finding, if true, would most directly support the passage's claim that vent communities depend on vent flow?",
 "choices": [
  "Tube worms removed from a vent field survived for months in cold seawater with no hydrogen sulfide.",
  "When a shift in the seafloor cut off a vent's flow, the animals at that field died within a year while a nearby active vent remained populated.",
  "Vent bacteria reproduce more quickly at warmer temperatures.",
  "Vent fields are more common along fast-spreading ridges than along slow-spreading ones."],
 "answer": "B",
 "choice_notes": ["this suggests the animals can persist without vent chemistry",
                  "correct",
                  "this shows a temperature effect, not a dependence on flow",
                  "this describes where vents occur, not what happens when flow stops"],
 "error_tags": ["concept", "none", "misread", "misread"],
 "explanation": "Dependence on flow predicts that communities fail when flow fails. B is a natural removal experiment: the flow stops, the community dies, and a comparable active vent persists. A points the other way, C addresses temperature rather than flow, and D is about geography.",
 "skill_note": "A claim of dependence is best supported by what happens when the thing depended on is removed."},
"RWP-0053": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"The technique is unforgiving\" most nearly means that the technique",
 "choices": [
  "produces images that are difficult to interpret",
  "allows almost no margin for error in aligning the light paths",
  "requires more telescopes than other observing methods do",
  "damages its instruments when atmospheric conditions change"],
 "answer": "B",
 "choice_notes": ["interpretation is not the difficulty described",
                  "correct",
                  "the number of telescopes is not presented as a burden",
                  "equipment damage is not mentioned"],
 "error_tags": ["misread", "none", "misread", "concept"],
 "explanation": "The sentences after the phrase supply the reason: paths matched to a fraction of a wavelength and timing to a fraction of a trillionth of a second. That is a tolerance so tight that error is nearly impossible to absorb.",
 "skill_note": "A judgment word followed by technical specifics is defined by those specifics."},
"RWP-0072": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"the standard was not what the text said but who was judged capable of saying it\" most nearly means that",
 "choices": [
  "the passages were too difficult for most applicants to read",
  "the outcome turned on the registrar's estimate of the applicant rather than on the applicant's reading",
  "applicants were graded against a written answer key",
  "literacy was measured by how fluently an applicant spoke"],
 "answer": "B",
 "choice_notes": ["text difficulty is secondary, since a university graduate could fail",
                  "correct",
                  "the passage says there was no answer key",
                  "speech is not what the passage describes being judged"],
 "error_tags": ["misread", "none", "concept", "misread"],
 "explanation": "The clause contrasts the content of the text with the registrar's judgment of the person reading it. Since the registrar both administered and scored the test with no key and no appeal, the outcome measured the official's estimate.",
 "skill_note": "The \"not X but Y\" frame tells you the answer must replace X with Y, not blend them."},
"RWP-0086": {
 "skill": "Command of evidence",
 "stem": "Which finding would most directly support the passage's claim that retrieval can alter a memory?",
 "choices": [
  "Participants who recalled a list while given a drug that blocks protein synthesis remembered fewer items a week later than participants given a placebo.",
  "Participants who studied a list for longer recalled more items than participants who studied briefly.",
  "Participants recalled concrete nouns more accurately than abstract nouns.",
  "Participants' accuracy was unaffected by how many times they were tested on the list."],
 "answer": "A",
 "choice_notes": ["correct",
                  "this concerns encoding, not retrieval",
                  "word concreteness is unrelated to the claim",
                  "this denies the effect the passage describes"],
 "error_tags": ["none", "misread", "misread", "concept"],
 "explanation": "If recall opens a window in which the memory can be weakened, then blocking protein synthesis during that window should reduce later retention. A shows exactly that. B addresses study time, C addresses material, and D asserts insensitivity to testing.",
 "skill_note": "The evidence has to intervene at retrieval, not at encoding."},
"RWP-0093": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"an outsized role\" most nearly means",
 "choices": [
  "an influence greater than its modest size would suggest",
  "a function that occupies more space than intended",
  "a responsibility that cities have neglected",
  "a purpose that has changed over the years"],
 "answer": "A",
 "choice_notes": ["correct",
                  "the phrase is figurative, not about physical dimensions",
                  "neglect is not what the phrase describes",
                  "no historical change is described"],
 "error_tags": ["none", "misread", "misread", "misread"],
 "explanation": "The sentence calls a bench \"a small piece of furniture\" and then credits it with a role in public life. The contrast between small size and large effect is the meaning.",
 "skill_note": "When a phrase sets two scales against each other, keep both in the paraphrase."},
"RWP-0099": {
 "skill": "Command of evidence",
 "stem": "Which finding would most directly support the passage's claim that bebop's rhythmic approach suited listeners rather than dancers?",
 "choices": [
  "Drummers recording for dance halls kept a steadier bass-drum pulse than drummers recording for club audiences.",
  "Bebop recordings sold fewer copies than swing recordings did.",
  "Bassists in bebop groups often played instruments built with lower action.",
  "Most pianists in bebop groups had studied classical technique."],
 "answer": "A",
 "choice_notes": ["correct",
                  "sales figures do not show how the music was heard or used",
                  "instrument setup is unrelated to rhythm",
                  "training background does not bear on the rhythmic claim"],
 "error_tags": ["none", "misread", "misread", "misread"],
 "explanation": "The claim links a rhythmic style to a setting. A shows the style tracking the setting within the same era: the same drummers played steadier time for dancers and freer time for club audiences. The other choices concern popularity, equipment, and training.",
 "skill_note": "Look for variation across settings, not a difference in outcome."},
"RWP-0104": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"their choices are legible in the result\" most nearly means that the choices",
 "choices": [
  "can be inferred from features of the translated text",
  "are explained in a preface the translator writes",
  "are difficult for ordinary readers to notice",
  "determine whether a translation succeeds or fails"],
 "answer": "A",
 "choice_notes": ["correct",
                  "no preface is mentioned in the passage",
                  "\"Legible\" implies the opposite, that they can be read off the text",
                  "the passage says neither approach is a failure"],
 "error_tags": ["none", "misread", "concept", "misread"],
 "explanation": "\"Legible\" is used figuratively: the translator's decisions leave traces a reader can read, which is why two versions visibly differ in warmth, contrast, or rhyme.",
 "skill_note": "A visual metaphor in an argument usually means \"detectable\", not \"written down\"."},
"RWP-0110": {
 "skill": "Inference",
 "stem": "It can most reasonably be inferred that the author's attitude toward the \"frozen jazz\" claim is",
 "choices": [
  "that it identifies a real change but describes it in terms that overstate how fixed the music became",
  "that it is entirely correct and needs no qualification",
  "that it is baseless and should be dismissed",
  "that it applies only to musicians who could not read music"],
 "answer": "A",
 "choice_notes": ["correct",
                  "the passage calls the claim strange and reframes it",
                  "the passage takes the underlying change seriously rather than dismissing it",
                  "music literacy is not discussed"],
 "error_tags": ["none", "misread", "concept", "misread"],
 "explanation": "The author grants that performance became document but objects to the word \"froze,\" since the final sentence leaves open whether the change is a loss. That is a claim about overstatement, not about falsity.",
 "skill_note": "Locate the sentence where the author translates the claim into something more precise."},
"RWP-0113": {
 "skill": "Words in context",
 "stem": "As used in the passage, \"what it weighed\" most nearly refers to",
 "choices": [
  "the physical effort of trimming the lamp each night",
  "the responsibility her father carried without complaint",
  "the importance of the harbor to the town",
  "the length of her father's service at the light"],
 "answer": "B",
 "choice_notes": ["the passage is about the meaning of the task, not its exertion",
                  "correct",
                  "the harbor's importance is context, not the referent",
                  "nineteen years is given as a duration, not as the burden"],
 "error_tags": ["misread", "none", "misread", "misread"],
 "explanation": "The clause contrasts nineteen years of nightly work with never mentioning \"what it weighed,\" which is the burden of knowing that lives depended on the light. The metaphor is about responsibility, not physical strain or time served.",
 "skill_note": "Ask what the pronoun would have to refer to for the sentence's contrast to work."},
}

# 150 tokens, RWP-0001..RWP-0150
DIFFICULTY_SEQUENCE = """
e e m m m e e e m m
v v e m m e m m e m
m m m m e e e m m h
e e m e e h h v m e
e h e e m h m m e e
m h m m e e m e e m
m h m e e m h e x e
h h e e m m h e h m
m m v m m m m m h m
e e e e e m e e m e
m m h h v m h m x v
m e x m e e e h e h
h m h x h v h v h x
h m m h v x h h v x
h h v v v v v x h m
"""



# Natural variants of the generic main-idea stem, rotated so the bank does not
# repeat one phrasing three dozen times. All accept sentence-length choices.
MAIN_IDEA_POOL = [
    "Which choice best states the main idea of the passage?",
    "Which choice best summarizes the passage?",
    "Which choice best expresses the central claim of the passage?",
    "Which choice best describes the main idea of the passage?",
    "Which choice best captures the passage's central idea?",
    "Which choice best states the passage's main point?",
]
MAIN_IDEA_GENERIC = "Which choice best states the main idea of the passage?"


def vary_stems(items):
    """Rotate the generic main-idea stem across natural variants."""
    k = 0
    for it in items:
        if it["stem"] == MAIN_IDEA_GENERIC:
            it["stem"] = MAIN_IDEA_POOL[k % len(MAIN_IDEA_POOL)]
            k += 1
    return k


def apply_explanations(items):
    """Swap in explanations that name distractors by content, not by letter."""
    import explanations
    used = 0
    for it in items:
        new = explanations.EXPLANATION_FIXES.get(it["id"])
        if new:
            it["explanation"] = new
            used += 1
    missing = set(explanations.EXPLANATION_FIXES) - {it["id"] for it in items}
    if missing:
        raise SystemExit("unmatched explanations: %s" % sorted(missing))
    return used


def balance_keys(items):
    """Distribute the credited option evenly across A-D in a seeded order.

    Choices, notes and error tags move together, so the note-to-choice pairing
    is preserved and only the option's position changes. The shuffle is seeded
    so builds are reproducible without producing a learnable sequence.
    """
    import random
    letters = "ABCD"
    n = len(items)
    targets = ["A"] * (n // 4 + n % 4) + ["B"] * (n // 4) + ["C"] * (n // 4) + ["D"] * (n // 4)
    assert len(targets) == n, (len(targets), n)
    random.Random(20261115).shuffle(targets)

    for it, want in zip(items, targets):
        cur = it["answer"]
        if want == cur:
            continue
        ci, wi = letters.index(cur), letters.index(want)
        for field in ("choices", "choice_notes", "error_tags"):
            seq = it[field]
            seq[ci], seq[wi] = seq[wi], seq[ci]
        it["answer"] = want


def difficulty_map(ids):
    toks = DIFFICULTY_SEQUENCE.split()
    if len(toks) != len(ids):
        raise SystemExit("difficulty sequence has %d tokens for %d items" % (len(toks), len(ids)))
    table = {"e": "easy", "m": "medium", "h": "hard", "v": "very_hard", "x": "extreme"}
    return {i: table[t] for i, t in zip(ids, toks)}
