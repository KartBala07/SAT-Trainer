#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble and validate the Reading & Writing passage bank.

Output: /Users/bala/SATPrep/generated/rw-passages.json  ->  {"items":[...]}
"""
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "rw-passages.json")

sys.path.insert(0, HERE)
import content_bio_earth
import content_tech_hist
import content_social_arts
import content_cross

INFO_SKILLS = {"Central ideas and details", "Inference", "Command of evidence"}
CRAFT_SKILLS = {"Words in context", "Text structure and purpose", "Cross-text connections"}
ALLOWED_TAGS = {"misread", "concept", "setup", "quantity", "none"}
LETTERS = "ABCD"


def words(text):
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-]*", text))


def domain_for(skill):
    if skill in INFO_SKILLS:
        return "Information and Ideas"
    if skill in CRAFT_SKILLS:
        return "Craft and Structure"
    raise ValueError("unknown skill: %r" % skill)


def build():
    items = []
    n = 0
    for mod in (content_bio_earth, content_tech_hist, content_social_arts):
        for p in mod.PASSAGES:
            for q in p["questions"]:
                n += 1
                items.append({
                    "id": "RWP-%04d" % n,
                    "section": "rw",
                    "domain": domain_for(q["skill"]),
                    "skill": q["skill"],
                    "difficulty": q["difficulty"],
                    "type": "mcq",
                    "passage": p["passage"],
                    "stem": q["stem"],
                    "choices": q["choices"],
                    "answer": q["answer"],
                    "choice_notes": q["choice_notes"],
                    "error_tags": q["error_tags"],
                    "explanation": q["explanation"],
                    "skill_note": q["skill_note"],
                })
    for p in content_cross.PAIRS:
        for q in p["questions"]:
            n += 1
            items.append({
                "id": "RWP-%04d" % n,
                "section": "rw",
                "domain": domain_for(q["skill"]),
                "skill": q["skill"],
                "difficulty": q["difficulty"],
                "type": "mcq",
                "passage": p["passage"],
                "passage2": p["passage2"],
                "stem": q["stem"],
                "choices": q["choices"],
                "answer": q["answer"],
                "choice_notes": q["choice_notes"],
                "error_tags": q["error_tags"],
                "explanation": q["explanation"],
                "skill_note": q["skill_note"],
            })
    return items


def validate(items):
    errors = []
    warnings = []

    if len(items) < 150:
        errors.append("item count %d < 150" % len(items))

    ids = [it["id"] for it in items]
    if len(set(ids)) != len(ids):
        errors.append("duplicate ids")
    expected = ["RWP-%04d" % i for i in range(1, len(items) + 1)]
    if ids != expected:
        errors.append("ids not sequential from RWP-0001")

    sigs = Counter()
    passages = Counter()
    for it in items:
        key = (it["passage"], it.get("passage2", ""), it["stem"])
        sigs[key] += 1
        passages[it["passage"]] += 1

    dup = [k for k, v in sigs.items() if v > 1]
    if dup:
        errors.append("%d duplicate passage+stem signatures" % len(dup))

    for it in items:
        iid = it["id"]
        if not it["stem"].strip():
            errors.append("%s empty stem" % iid)
        if not it["passage"].strip():
            errors.append("%s empty passage" % iid)
        if len(it["choices"]) != 4:
            errors.append("%s has %d choices" % (iid, len(it["choices"])))
        if any(not str(c).strip() for c in it["choices"]):
            errors.append("%s empty choice text" % iid)
        if len(set(c.strip().lower() for c in it["choices"])) != len(it["choices"]):
            errors.append("%s duplicate choice text" % iid)
        if it["answer"] not in list(LETTERS):
            errors.append("%s bad answer %r" % (iid, it["answer"]))
        notes = it["choice_notes"]
        if len(notes) != 4:
            errors.append("%s has %d choice_notes" % (iid, len(notes)))
        else:
            key_idx = LETTERS.index(it["answer"]) if it["answer"] in LETTERS else -1
            if key_idx >= 0 and notes[key_idx].strip().lower() != "correct":
                errors.append("%s key note is %r, not 'correct'" % (iid, notes[key_idx]))
            others = [n for j, n in enumerate(notes) if j != key_idx]
            if any(n.strip().lower() == "correct" for n in others):
                errors.append("%s has 'correct' outside the key" % iid)
            if any(not str(n).strip() for n in notes):
                errors.append("%s has an empty choice note" % iid)
        tags = it["error_tags"]
        if len(tags) != 4:
            errors.append("%s has %d error_tags" % (iid, len(tags)))
        bad = [t for t in tags if t not in ALLOWED_TAGS]
        if bad:
            errors.append("%s bad error_tags %r" % (iid, bad))
        if it["answer"] in LETTERS and tags[LETTERS.index(it["answer"])] != "none":
            errors.append("%s key error_tag should be 'none'" % iid)
        if it["domain"] not in ("Information and Ideas", "Craft and Structure"):
            errors.append("%s bad domain %r" % (iid, it["domain"]))
        if it["difficulty"] not in ("easy", "medium", "hard", "very_hard", "extreme"):
            errors.append("%s bad difficulty %r" % (iid, it["difficulty"]))
        if it["section"] != "rw" or it["type"] != "mcq":
            errors.append("%s bad section/type" % iid)
        for fld in ("explanation", "skill_note"):
            if not it[fld].strip():
                errors.append("%s empty %s" % (iid, fld))

        # length rules
        w = words(it["passage"])
        if "passage2" in it:
            w2 = words(it["passage2"])
            if not (40 <= w <= 80):
                warnings.append("%s Text 1 is %d words (target 40-80)" % (iid, w))
            if not (40 <= w2 <= 80):
                warnings.append("%s Text 2 is %d words (target 40-80)" % (iid, w2))
            if w > 160 or w2 > 160:
                errors.append("%s cross text exceeds 160 words" % iid)
        else:
            if w > 160:
                errors.append("%s passage is %d words (>160)" % (iid, w))
            if not (50 <= w <= 130):
                warnings.append("%s passage is %d words (target 50-130)" % (iid, w))

    return errors, warnings, sigs, passages


def main():
    items = build()
    errors, warnings, sigs, passages = validate(items)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    dom = Counter(it["domain"] for it in items)
    diff = Counter(it["difficulty"] for it in items)
    skill = Counter(it["skill"] for it in items)
    n_single = sum(1 for it in items if "passage2" not in it)
    n_cross = len(items) - n_single

    print("=" * 62)
    print("R&W PASSAGE BANK — BUILD REPORT")
    print("=" * 62)
    print("file                : %s" % OUT)
    print("items               : %d" % len(items))
    print("  single-passage    : %d  (%d passages x 3)" % (n_single, len(content_bio_earth.PASSAGES) + len(content_tech_hist.PASSAGES) + len(content_social_arts.PASSAGES)))
    print("  cross-text        : %d  (%d pairs x 2)" % (n_cross, len(content_cross.PAIRS)))
    print("distinct passages   : %d" % len(passages))
    print("distinct signatures : %d" % len(sigs))
    print()
    print("domain counts")
    for k in ("Information and Ideas", "Craft and Structure"):
        print("  %-24s %3d  (%4.1f%%)" % (k, dom[k], 100.0 * dom[k] / len(items)))
    print()
    print("difficulty counts")
    for k in ("easy", "medium", "hard", "very_hard", "extreme"):
        print("  %-24s %3d  (%4.1f%%)" % (k, diff[k], 100.0 * diff[k] / len(items)))
    print()
    print("skill counts")
    for k, v in sorted(skill.items(), key=lambda kv: -kv[1]):
        print("  %-28s %3d" % (k, v))
    print()

    lens = [words(it["passage"]) for it in items if "passage2" not in it]
    lens2 = [words(it["passage2"]) for it in items if "passage2" in it]
    print("passage length      : single min %d / mean %.1f / max %d"
          % (min(lens), sum(lens) / len(lens), max(lens)))
    print("                      cross  min %d / mean %.1f / max %d"
          % (min(lens2), sum(lens2) / len(lens2), max(lens2)))
    print()
    print("validation          : %s" % ("PASS" if not errors else "FAIL"))
    print("  errors            : %d" % len(errors))
    for e in errors:
        print("    - %s" % e)
    print("  length warnings   : %d" % len(warnings))
    for w in warnings:
        print("    - %s" % w)
    print("=" * 62)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
