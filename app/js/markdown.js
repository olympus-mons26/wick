(function (global) {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    const t = String(url).trim();
    if (/^(https?:|mailto:|#|\.\/|\/|[A-Za-z0-9._~-]+(\.md|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp)?$)/i.test(t)) {
      return t;
    }
    return "#";
  }

  function inline(text) {
    const codes = [];
    let s = text.replace(/`([^`]+)`/g, (_, code) => {
      codes.push("<code>" + escapeHtml(code) + "</code>");
      return "\u0000C" + (codes.length - 1) + "\u0000";
    });

    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      return '<img alt="' + escapeHtml(alt) + '" src="' + escapeHtml(safeUrl(url)) + '">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      return '<a href="' + escapeHtml(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/(^|[^\w])_([^_]+)_([^\w]|$)/g, "$1<em>$2</em>$3");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[Number(i)]);
    return s;
  }

  function isTableSep(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitRow(line) {
    let t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  }

  function renderMarkdown(src) {
    const fences = [];
    let text = String(src).replace(/\r\n/g, "\n");
    text = text.replace(/```([A-Za-z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const html =
        "<pre><code" +
        (lang ? ' class="language-' + escapeHtml(lang) + '"' : "") +
        ">" +
        escapeHtml(code.replace(/\n$/, "")) +
        "</code></pre>";
      fences.push(html);
      return "\n\u0000F" + (fences.length - 1) + "\u0000\n";
    });

    const lines = text.split("\n");
    const out = [];
    let i = 0;
    let para = [];

    function flushPara() {
      if (!para.length) return;
      out.push("<p>" + inline(para.join("\n")) + "</p>");
      para = [];
    }

    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\u0000F(\d+)\u0000$/);

      if (fence) {
        flushPara();
        out.push(fences[Number(fence[1])]);
        i += 1;
        continue;
      }

      if (/^\s*$/.test(line)) {
        flushPara();
        i += 1;
        continue;
      }

      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushPara();
        out.push("<hr>");
        i += 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushPara();
        const level = heading[1].length;
        out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
        i += 1;
        continue;
      }

      if (i + 1 < lines.length && line.includes("|") && isTableSep(lines[i + 1])) {
        flushPara();
        const head = splitRow(line);
        i += 2;
        const body = [];
        while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
          body.push(splitRow(lines[i]));
          i += 1;
        }
        let html = "<table><thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
        body.forEach((row) => {
          html += "<tr>" + row.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>";
        });
        html += "</tbody></table>";
        out.push(html);
        continue;
      }

      if (/^\s*>/.test(line)) {
        flushPara();
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i += 1;
        }
        out.push("<blockquote>" + renderMarkdown(quote.join("\n")) + "</blockquote>");
        continue;
      }

      const ul = line.match(/^(\s*)([-*+])\s+(.*)$/);
      const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        const ordered = Boolean(ol);
        const items = [];
        while (i < lines.length) {
          const u = lines[i].match(/^(\s*)([-*+])\s+(.*)$/);
          const o = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
          const m = ordered ? o : u;
          if (!m) break;
          items.push(m[3]);
          i += 1;
        }
        const tag = ordered ? "ol" : "ul";
        const lis = items
          .map((item) => {
            const task = item.match(/^\[([ xX])\]\s+(.*)$/);
            if (task) {
              const checked = task[1] !== " " ? " checked" : "";
              return '<li class="task"><input type="checkbox" disabled' + checked + "> " + inline(task[2]) + "</li>";
            }
            return "<li>" + inline(item) + "</li>";
          })
          .join("");
        out.push("<" + tag + ">" + lis + "</" + tag + ">");
        continue;
      }

      para.push(line);
      i += 1;
    }
    flushPara();
    return out.join("\n");
  }

  global.renderMarkdown = renderMarkdown;
})(window);
