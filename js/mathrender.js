/* ============ math + markup rendering ============ */
(function (global) {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  function katexOK() {
    return typeof global.katex !== 'undefined' && global.katex && typeof global.katex.renderToString === 'function';
  }

  function mathSpan(token) {
    const display = token.startsWith('$$');
    const tex = (display ? token.slice(2, -2) : token.slice(1, -1)).split(D_ESC).join('\\$');
    if (!katexOK()) return `<span class="k-math">${esc(tex)}</span>`;
    try {
      return global.katex.renderToString(tex.trim(), {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: false,
        errorColor: '#dc2626',
        macros: { '\\degree': '^{\\circ}', '\\dms': '' },
      });
    } catch (e) {
      return `<span class="k-math" title="${esc(e.message)}">${esc(tex)}</span>`;
    }
  }

  const D_ESC = '\uE000'; // placeholder for a literal \$ inside math

  function renderInline(text) {
    // Protect escaped dollars (\$) so they don't terminate a math span: the SAT
    // writes dollar amounts as $\$80$ and the naive delimiter split breaks it.
    const src = String(text == null ? '' : text).replace(/\\\$/g, D_ESC);
    const re = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      out += mathSpan(m[1]);
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    // light typographic sugar for non-math text
    out = out
      .replace(/--/g, '–')
      .replace(/(\d)\s*x\s*(\d)/g, '$1 × $2');
    return out;
  }

  /* --- pipe tables ---
     Pipes inside $...$ are absolute value bars, not cell separators, so the row
     test runs on a copy with math spans masked out. A table only starts when the
     next line is a |---|---| separator, which keeps "expand |2x-5|=11" as prose. */
  function maskMath(line) {
    return String(line).replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, '\uE001');
  }
  function isTableRow(line) {
    const t = maskMath(line).trim();
    if (!t.includes('|')) return false;
    return t.split('|').filter((c) => c.trim() !== '').length >= 2;
  }
  function isSeparator(line) {
    const t = maskMath(line).trim();
    return t.includes('|') && /^\|?[\s:|-]*-{2,}[\s:|-]*\|?$/.test(t);
  }
  function splitRow(line) {
    let t = String(line).trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
  }
  function tableHTML(rows) {
    const head = rows[0] || [];
    const body = rows.slice(1);
    const th = head.map((c) => `<th>${renderInline(c)}</th>`).join('');
    const tb = body
      .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
      .join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
  }

  function render(text) {
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    let html = '';
    let para = [];

    const flushPara = () => {
      if (!para.length) return;
      html += `<p>${renderInline(para.join('\n')).replace(/\n/g, '<br>')}</p>`;
      para = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
        flushPara();
        const rows = [splitRow(line)];
        i += 2;
        while (i < lines.length && isTableRow(lines[i]) && !isSeparator(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        i--;
        html += tableHTML(rows);
        continue;
      }
      if (line.trim() === '') flushPara();
      else para.push(line);
    }
    flushPara();
    return html || '<p></p>';
  }

  /* Renders into an element, then reports any KaTeX parse errors so we can spot
     broken LaTeX in the bank during QA. */
  function renderInto(el, text) {
    el.innerHTML = render(text);
    const bad = el.querySelectorAll('.katex-error');
    return bad.length;
  }

  global.MathR = { esc, render, renderInline, renderInto, katexOK };
})(window);
