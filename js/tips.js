/* ============ views: Desmos tricks + timing playbook ============ */
(function (global) {
  'use strict';
  const { esc, renderInline } = global.MathR;
  const { el, ICONS } = global.Views;

  const DESMOS = [
    {
      t: 'Solve any one-variable equation without algebra',
      d: 'Type the whole equation exactly as written. Desmos draws where both sides are equal; click the intersection point and read the x-value. This works for linear, rational, radical, and absolute-value equations — it is the single highest-value move on the math section.',
      e: '3(2x-5) = 4x + 11',
      when: 'Any equation with x on both sides and no tidy factoring. ~15 seconds vs ~60 by hand.',
    },
    {
      t: 'Systems: answer in one click, no substitution',
      d: 'Enter both equations on separate lines. Desmos plots both lines and marks the intersection. Click the point: you get (x, y) exactly. If the lines are parallel you get no point — that is the "no solution" answer; if they overlap completely, "infinitely many".',
      e: '2x + 3y = 12\ny = x - 1',
      when: 'Every 2×2 system. Also the fastest way to see whether a parameterized system has 0, 1, or infinite solutions.',
    },
    {
      t: 'Turn a parameter into a slider and watch it move',
      d: 'Type an expression containing a letter — Desmos offers "add slider". Drag it and watch the graph change. For "for what value of k does the system have no solution", set k as a slider and slide until the lines are parallel. For "exactly one solution" with a parabola, slide until the line is tangent.',
      e: 'y = x^2 - 4x + k',
      when: 'Any question with a constant k, c, a, or b that changes the number of solutions.',
    },
    {
      t: 'Read vertex, roots, and intercepts off the graph',
      d: 'Graph the quadratic and click the points Desmos marks: the vertex (min/max) and the x-intercepts (solutions). You never have to complete the square under time pressure — but know how, because some questions ask for the *form*, not the value.',
      e: 'y = 2x^2 - 12x + 11',
      when: 'Asking for a minimum, maximum, number of solutions, or roots.',
    },
    {
      t: 'Inequalities: see the region, not the algebra',
      d: 'Type the inequality. Desmos shades the solution region, and the boundary line tells you whether points on it count (solid vs dashed). For systems of inequalities, the overlap is your answer.',
      e: 'y < 2x + 1',
      when: 'Any "which point satisfies the system" question — test each choice in 5 seconds.',
    },
    {
      t: 'Define a function, then evaluate it anywhere',
      d: 'Define f(x) once, then call f(3) or f(g(2)) and Desmos returns the value. Composition, inverses ("find x such that f(x)=5" — graph y=f(x) and y=5 and read the intersection), and function notation tables all collapse.',
      e: 'f(x) = 3x - 2\nf(5)',
      when: 'Function notation, composition, piecewise evaluation.',
    },
    {
      t: 'Piecewise functions in one line',
      d: 'Desmos uses brace notation with conditions. Type it exactly and check the break point — whether the two pieces meet (continuous) or jump.',
      e: 'f(x) = {x < 3: 2x + a, x >= 3: -x + b}',
      when: 'Piecewise questions, and "no break at x = k" conditions.',
    },
    {
      t: 'Statistics without arithmetic risk',
      d: 'Desmos has mean, median, total, stdev, and count built in. Put the list in and read the output instead of adding six numbers by hand.',
      e: 'mean([4, 5, 5, 6, 8, 14])\nmedian([32, 35, 38, 41, 44, 210])',
      when: 'Mean, median, and comparisons between two data sets.',
    },
    {
      t: 'Line of best fit from a table',
      d: 'Add a table, paste the points, then write a regression. Desmos returns slope and intercept with subscripts — exactly what "interpret the slope" questions need.',
      e: 'y_1 ~ m x_1 + b',
      when: 'Scatterplot questions where a table of values is given.',
    },
    {
      t: 'Check a grid-in before you commit',
      d: 'Grid-ins have no answer choices, so a mis-keyed answer is silent. Enter the expression, read the decimal, then convert: 0.6666… is 2/3, 1.333… is 4/3. Desmos does not accept fractions as final answers in the real test — you type 2/3 or .6667.',
      e: '2/3',
      when: 'Every student-produced response, as a five-second sanity check.',
    },
    {
      t: 'Degrees and radians without converting by hand',
      d: 'Type the degree symbol (or use the keypad) and Desmos evaluates in degrees. For radians, just use pi. Arc length and sector area become a single multiplication you can see.',
      e: 'sin(30°)',
      when: 'Trig ratio and unit-circle questions.',
    },
    {
      t: 'Zoom out before you decide there is no solution',
      d: 'The default window is [-10,10]. A parabola and a line can look like they never meet until you zoom out. If a question says "exactly two solutions" and you see none, widen the window before you trust your eyes.',
      when: 'Always, when the graph looks empty. Two seconds, saves a wrong answer.',
    },
  ];

  const TIMING = [
    {
      t: 'Reading & Writing — 71 seconds a question',
      d: '27 questions, 32 minutes. Two passes: pass one, answer everything you can decide in under 45 seconds and flag the rest. Pass two, spend the remaining time on flagged items. Never let a single question pass 2 minutes on the first pass.',
      k: '27 q · 32 min',
    },
    {
      t: 'Read the question stem first, then the passage',
      d: 'On R&W the question tells you what to look for. Reading the passage first means reading it twice. For "which choice best states the main idea", skim the first and last sentence and the topic shifts; for "as used in the text", read only the sentence containing the word plus one on either side.',
      k: 'saves 20-30s',
    },
    {
      t: 'Math — 95 seconds a question',
      d: '22 questions, 35 minutes. Budget: 60-75 seconds on the straightforward 15, flag the 4 hardest, then come back with 8-10 minutes left. The last 3 questions of module 2 are the hardest on the test — they are not worth four minutes each while easier points sit unanswered.',
      k: '22 q · 35 min',
    },
    {
      t: 'Two-pass rule, both sections',
      d: 'Your first pass should never get stuck. Every question has a one-sentence version of itself; if you cannot see it in 20 seconds, flag and move. Coming back with fresh eyes is faster than grinding forward with tired ones.',
      k: 'always',
    },
    {
      t: 'Finish with 3-4 minutes spare',
      d: 'The buffer is the whole point. It absorbs the one question that eats ninety seconds and still leaves time to check flagged items. If you finish with zero minutes left, you got lucky, not efficient.',
      k: 'buffer',
    },
    {
      t: 'Graph vs algebra: a 20-second decision',
      d: 'Ask: does this question give me an equation and ask for a value? Graph it. Does it ask for an *equivalent form* or a *form that displays a feature*? Algebra, because Desmos cannot show you form. That single distinction decides most math time losses.',
      k: 'math',
    },
    {
      t: 'Never leave a blank',
      d: 'There is no wrong-answer penalty. On a grid-in you cannot guess, but you can eliminate and estimate — a plausible value beats a blank every time. On multiple choice, eliminate two and pick.',
      k: 'free points',
    },
    {
      t: 'The 10-minute break is part of the test',
      d: 'Stand up, look at something far away, drink water. Do not review questions in your head — the module is closed and rumination costs focus for the second half.',
      k: 'between sections',
    },
  ];

  function view(state) {
    const settings = state.settings || {};
    return el(`<div class="wrap">
      <div class="hero">
        <div>
          <h1>Desmos tricks &amp; timing playbook</h1>
          <p class="sub">The calculator is not a crutch, it is a second solver. These are the moves that turn five minutes of algebra into twenty seconds — and the pacing plan that keeps you from spending them on the wrong question.</p>
        </div>
        <button class="btn primary lg" data-start="${settings.lastSection || 'full'}">Start a test ${ICONS.arrow}</button>
      </div>

      <div class="section-h"><h2>Desmos — 12 moves</h2></div>
      <div class="tips-grid">
        ${DESMOS.map((x, i) => `<div class="tip-card">
          <div class="tip-num">${String(i + 1).padStart(2, '0')}</div>
          <h4>${esc(x.t)}</h4>
          <p>${esc(x.d)}</p>
          ${x.e ? `<div class="tip-expr"><code>${esc(x.e)}</code><button class="btn ghost" style="height:26px;font-size:11.5px;padding:0 8px" data-desmos="${esc(x.e)}">Graph it</button></div>` : ''}
          ${x.when ? `<p class="tip-when"><strong>When:</strong> ${esc(x.when)}</p>` : ''}
        </div>`).join('')}
      </div>

      <div class="section-h"><h2>Timing — the plan for each section</h2></div>
      <div class="tips-grid">
        ${TIMING.map((x) => `<div class="tip-card">
          <div class="tip-kicker">${esc(x.k)}</div>
          <h4>${esc(x.t)}</h4>
          <p>${esc(x.d)}</p>
        </div>`).join('')}
      </div>

      <div class="card panel" style="margin-top:22px">
        <h3>The one rule that beats everything else</h3>
        <p class="p-sub" style="margin-bottom:10px">A 1500 is not built on hard questions. It is built on never missing the easy ones.</p>
        <p style="font-size:14px;line-height:1.7;color:var(--ink-2);max-width:78ch">
          On a typical form the easy and medium questions are worth the same raw point as the extreme ones. Most students who plateau at 1350 are not failing the hard questions — they are losing four or five points to misread questions, sign errors, and unfinished arithmetic under time pressure. Fix the execution errors first; the ceiling takes care of itself.
        </p>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn primary" data-start="full">Take a full test</button>
          <button class="btn" data-home>Back to home</button>
        </div>
      </div>
    </div>`);
  }

  global.Tips = { view };
})(window);
