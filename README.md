# SAT Math Trainer

A local Digital-SAT math trainer built for one job: getting the math section to ~750 in two weeks.

```
node server.mjs        # then open http://127.0.0.1:8899
```
or just double-click **Start SAT Trainer.command**.

Zero dependencies. Node only. Everything is stored on this Mac.

---

## What's in it

**113 questions**, all written to the Digital SAT's exact formats — 4-choice MCQ plus student-produced-response grid-ins — spanning five difficulty tiers:

| Tier | Count | What it means |
|---|---|---|
| Easy | 24 | first third of module 1 |
| Medium | 30 | the bulk of module 1 |
| Hard | 27 | back half of module 1, most of module 2 |
| Very Hard | 18 | end of the hard module 2 |
| Extreme | 14 | the 2–3 questions that separate 700 from 780 |

Domains are weighted like the real test: Algebra 8/module, Advanced Math 7, Problem-Solving & Data Analysis 4, Geometry & Trigonometry 3.

Every answer key was verified numerically. Every wrong choice is annotated with the specific error that produces it (sign flip, wrong base for a percent, diameter-instead-of-radius, solved for x instead of the expression, …).

**Questions are original.** College Board's real test items are copyrighted and can't be copied into an app, so these are written to the same formats, traps, and difficulty curve. Your final dress rehearsal should be an official released form: <https://satsuite.collegeboard.org/practice/practice-tests>.

## Modes

- **Full Math Section — adaptive.** Module 1 (22 q, 35 min) sets your level. Score ≥12/22 and you get the *hard* module 2 (22 q, 35 min, mostly Hard/Very Hard/Extreme); below that, the standard module 2. Exactly how Bluebook routes you.
- **Quick 10** — 10 questions climbing easy→extreme, 15 minutes. Fastest honest read on where you stand.
- **Difficulty ladder** — 12 questions, one per tier, untimed. Finds the exact tier where you break.
- **Domain drill** — 12 questions in one domain, climbing in difficulty.
- **Weak-spot review** — the questions you missed on your last attempt, in order.

## The calculator

A real **Desmos** graphing calculator is embedded in the right panel (Desmos's own API, not a screenshot). It docks beside the question instead of covering it — the question column reflows. Every solution has a `Desmos:` line with the exact expression to graph, and **Graph it** drops it straight into the calculator.

`Reference` opens the formula sheet the real test gives you. `Scientific` tab is a plain keypad calculator.

Keyboard: `A`–`D` pick an answer · `←`/`→` navigate · `F` flag · `Tab` calculator · `R` reference sheet · `Esc` close.

## Scoring

Raw correct (out of 44) → 200–800 math score using a conversion table interpolated from released digital forms, with a small adjustment for which module 2 you got (harder items are worth more, as in the real adaptive model). Percentile is an approximate national math percentile.

Accuracy is roughly **±30 points**. Short modes (Quick 10, drills) are proportionally projected onto the 44-question scale and labelled as such.

Set your real Reading & Writing score with the `✎` next to "with RW at …" on the home screen — that's what turns a math score into a projected total.

## The analysis

After every attempt:

- **Score ring** + percentile + projected total
- **By content domain** — accuracy, average time, where the points are
- **By difficulty** — the cumulative-accuracy curve, i.e. the tier you're solid through and the tier you break down at
- **Why you lost points** — every miss tagged with the error that produced it, split into *execution* errors (sign, arithmetic, misread: points you already own) vs *knowledge* gaps
- **Pace** — average seconds/question vs the 95-second target, how many you burned by rushing, how many you solved slowly
- **Question-by-question review** — expand any miss for the worked solution, what your specific wrong answer implies, and the Desmos move
- **A 14-day plan** built from that attempt: weakest domain first, with the exact skills you missed and a full retest on day 7 and day 12

Attempts accumulate in **Score history** with a bar chart of every score on the 200–800 scale, so "am I actually improving" has an answer.

## Files

```
server.mjs                 zero-dep HTTP server + /api/bank /api/history /api/settings
public/index.html          shell
public/styles.css          design system (light + dark)
public/js/engine.js        pool building, adaptive modules, scoring, analysis, plan
public/js/mathrender.js    KaTeX + pipe-table renderer
public/js/views.js         home + test views
public/js/results.js       results + history views
public/js/app.js           state, timer, calculator, routing
question-packs/*.json      the bank (drop another pack here, restart, it joins the pool)
public/vendor/katex*       vendored math typesetting (works offline)
data/history.json          attempts
data/settings.json         your RW score
```

To add questions, drop a JSON file in `question-packs/` with the shape used by the existing packs, then restart the server. `curl http://127.0.0.1:8899/api/reload` reloads without a restart.

## How to actually use the two weeks

1. Take the **full test** cold today. Do not study first. The score is the baseline, not a judgment.
2. Read **Why you lost points** before you read the review list. If execution errors outnumber knowledge gaps, your fastest points are free — that's a 30–60 point jump with zero new content.
3. Do the **14-day plan** the results page gives you. Day 7 and day 12 are full retests; compare domain accuracy, not just the score.
4. The night before: reference sheet, five easy questions, close the laptop.
