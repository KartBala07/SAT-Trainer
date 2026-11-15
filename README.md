# SAT Trainer

Full-length Digital SAT practice, in the real format, scored on the real scale.

**Live:** <https://kartbala07.github.io/SAT-Trainer/>
**Local:** double-click `Start SAT Trainer.command`, or `node server.mjs` → <http://127.0.0.1:8899>

---

## What this is

A four-module Digital SAT simulation — Reading & Writing module 1 and 2, then Math module 1 and 2 — with adaptive routing inside each section, one break where the real test has one, and a total score on the 400–1600 scale.

| | Reading & Writing | Math |
|---|---|---|
| Modules | 2 × 27 questions | 2 × 22 questions |
| Time per module | 32 min | 35 min |
| Scored | 200–800 | 200–800 |
| Adaptive routing | ≥16/27 in module 1 → hard module 2 | ≥12/22 → hard module 2 |

98 questions, 134 minutes, 60 reproducible forms. Form #1 always deals the same test; every form number is a different draw from the bank.

## The question bank

**2,200+ questions**, all original, generated parametrically and verified by construction — the generator computes the answer, then substitutes it back into the problem and drops the item if it doesn't check. Nothing is hand-keyed.

| | Coverage |
|---|---|
| **Math** | Algebra · Advanced Math · Problem-Solving & Data Analysis · Geometry & Trigonometry |
| **Reading & Writing** | Information & Ideas · Craft & Structure · Expression of Ideas · Standard English Conventions |

Five difficulty tiers — Easy, Medium, Hard, Very Hard, Extreme — with module profiles that mirror the real test: module 1 is medium-heavy with a couple of hard items, the standard module 2 is easier, and the hard module 2 is dominated by Hard / Very Hard / Extreme.

Every wrong answer carries the **specific error** that produces it (`sign`, `concept`, `setup`, `quantity`, `unit`, `misread`, `arithmetic`), plus a one-line note like *"used the diameter as the radius"*. That tagging is what makes the post-test diagnosis specific instead of generic.

## Reading & Writing

Each question gets its own passage, exactly like the real section: one short block for most questions, side-by-side Text 1 / Text 2 for cross-text connections. Tested words are underlined in context, blanks are drawn as blanks, and a grammar question's explanation names the rule it applied.

| Domain | What it covers |
|---|---|
| Information & Ideas | main idea, detail, inference, command of evidence, quantitative evidence |
| Craft & Structure | words in context, text structure and purpose, cross-text connections |
| Expression of Ideas | transitions (contrast / cause / addition / concession / example), rhetorical synthesis |
| Standard English Conventions | semicolons, colons, dashes, commas, apostrophes, subject-verb agreement, pronouns, tense, parallelism, modifiers |

## Desmos

A real Desmos graphing calculator (their API, not a screenshot) docks on the right and **reflows the question instead of covering it**. Press `Tab`, or the Calculator button.

Every solution carries the exact expression that solves it, and **Graph it** drops it straight into the calculator — including multi-line systems. The **Desmos tricks & timing** page has the twelve moves worth memorising (graph the system, slider the parameter, regression for a line of best fit, statistics without arithmetic) plus the per-question pacing plan for both sections.

## The diagnosis

After every attempt:

- **Score ring** — 400–1600 for a full test, 200–800 for a single section
- **Per-section panels** — raw score, module-2 path, accuracy by content domain, average seconds per question
- **Difficulty curve** — cumulative accuracy by tier, so you see the level you're *solid through* and the level where you break down (a single lucky hard question can't inflate it)
- **Why you lost points** — every miss tagged, split into *execution* errors you already own vs *knowledge* gaps you don't
- **Pace** — average vs the real per-question budget, how many you burned rushing, how many you solved too slowly
- **Question-by-question review** — the passage, the stem, your answer, the correct one, the worked solution, and what your specific wrong answer implies
- **A 14-day plan** built from that attempt, starting with your weakest domain by name, with full retests on day 7 and day 12

Attempts accumulate in **Score history** (stored in the browser) with a bar chart on the 400–1600 scale, so "am I actually improving" has an answer.

## Scoring accuracy

Raw → scaled uses a conversion table interpolated from released digital forms, with a small adjustment for which module 2 you earned. Treat section scores as ±30 points. The percentile shown is an approximate national percentile.

## Repo layout

```
index.html               shell
styles.css styles2.css   design system (light + dark)
js/engine.js             module construction, adaptive routing, scoring, analysis, plan
js/views.js              home, test, passage rendering
js/tips.js               Desmos + timing playbook
js/results.js            results, history
js/app.js                state, timer, calculator, routing
js/mathrender.js         KaTeX + pipe-table renderer
data/{manifest,math,rw}.json   the materialised bank (what the site loads)
question-packs/*.json    hand-authored questions
generators/*.mjs         parametric generators (source of the bulk)
build-bank.mjs           generators -> data/*.json, validates + de-duplicates
server.mjs               zero-dependency static server for local use
vendor/                  KaTeX (works offline)
```

Regenerate the bank after editing generators or packs:

```
node build-bank.mjs
```

It reports per-source counts, difficulty spread, and every item it dropped or repaired. Adding a pack is just dropping a JSON file in `question-packs/` with the same shape and re-running the build.

## Accounts, backend, guest mode

**Guest mode is the default and needs nothing.** No account, no network, no server — attempts, scores, the 14-day plan and history all live in this browser's local storage. The chip in the top bar says *Guest*.

Signing in only adds cross-device sync. The backend in `server.mjs` is zero-dependency (`node:http`, `node:sqlite`, `node:crypto`) and stores accounts in `data/accounts.db`, which the static handler refuses to serve.

```
node server.mjs                 # http://127.0.0.1:8899
SAT_DEV_AUTH=1 node server.mjs  # adds a dev sign-in button (never use in production)
```

API: `POST /api/auth/google`, `POST /api/auth/dev`, `GET /api/me`, `POST /api/auth/logout`,
`GET /api/progress`, `PUT /api/progress` (union merge, idempotent per attempt).

### Turning on Google sign-in

1. In Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. Under **Authorised JavaScript origins** add every origin the app runs on:
   `http://localhost:8899` and, if you use Pages, `https://kartbala07.github.io`.
3. Start the server with the client ID:
   ```
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com node server.mjs
   ```
   or put it in `config.local.json` as `{"googleClientId": "…"}`.
4. If the front end is served from a different origin than the backend (Pages → hosted API), set `apiBase` in `js/config.js` to the backend URL and add the front-end origin to `SAT_ALLOWED_ORIGINS` on the server:
   ```
   SAT_ALLOWED_ORIGINS=https://kartbala07.github.io
   ```

Until step 3 is done, the panel says sign-in isn't configured and guest mode carries on — nothing breaks.

### Hosting the backend

GitHub Pages only serves files, so the API has to live somewhere that runs Node: Render, Fly.io, Railway, a VPS, or just your laptop. Run `node server.mjs`, set `PORT`, `GOOGLE_CLIENT_ID` and `SAT_ALLOWED_ORIGINS`, and point `apiBase` at it. The database is a single file, so back it up by copying `data/accounts.db`.

### How the auth works

The browser gets a Google ID token (Google Identity Services) and posts it to the backend, which verifies the RS256 signature against Google's published keys and checks `iss`, `aud` and `exp` before opening a session. The session is a 32-byte random token, returned to the client and also set as an `HttpOnly`, `SameSite` cookie for same-origin use.

## Two things worth knowing

1. **These questions are original.** College Board's real items are copyrighted, so these are written to the same formats, traps and difficulty curve. For your final dress rehearsal, use an official released form: <https://satsuite.collegeboard.org/practice/practice-tests>.
2. **The app works without the server.** Guest mode is a static site: open it from GitHub Pages, or locally through `server.mjs`. Progress lives in your browser's local storage, so clearing site data clears your history — sign in if you want it on more than one device.
