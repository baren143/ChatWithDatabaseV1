/** Converts LLM markdown output (lists, tables, bold) into HTML. */
export function renderContent(text: string): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let inTable = false;
  let tableHeaderDone = false;
  let inList = false;

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderInline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  const isTableRow = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|");
  const isSeparator = (l: string) => /^\|[\s|:-]+\|$/.test(l.trim());

  for (const raw of lines) {
    const line = raw.trim();

    if (isTableRow(line)) {
      if (isSeparator(line)) {
        tableHeaderDone = true;
        continue;
      }
      if (!inTable) {
        if (inList) {
          output.push("</ol>");
          inList = false;
        }
        output.push('<div style="overflow-x:auto;margin:0.6rem 0"><table class="md-table"><thead><tr>');
        inTable = true;
        tableHeaderDone = false;
        const cells = line.split("|").slice(1, -1);
        cells.forEach((c) => output.push(`<th>${renderInline(c.trim())}</th>`));
        output.push("</tr></thead><tbody>");
      } else if (tableHeaderDone) {
        output.push("<tr>");
        const cells = line.split("|").slice(1, -1);
        cells.forEach((c) => output.push(`<td>${renderInline(c.trim())}</td>`));
        output.push("</tr>");
      }
      continue;
    }

    if (inTable) {
      output.push("</tbody></table></div>");
      inTable = false;
      tableHeaderDone = false;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (!inList) {
        output.push('<ol class="md-list">');
        inList = true;
      }
      output.push(`<li>${renderInline(numMatch[2])}</li>`);
      continue;
    }

    if (inList) {
      output.push("</ol>");
      inList = false;
    }

    if (!line) {
      output.push("<br/>");
      continue;
    }

    if (line.startsWith("### ")) {
      output.push(`<h4 class="md-h4">${renderInline(line.slice(4))}</h4>`);
      continue;
    }
    if (line.startsWith("## ")) {
      output.push(`<h3 class="md-h3">${renderInline(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith("# ")) {
      output.push(`<h2 class="md-h2">${renderInline(line.slice(2))}</h2>`);
      continue;
    }

    output.push(`<p class="md-p">${renderInline(line)}</p>`);
  }

  if (inTable) output.push("</tbody></table></div>");
  if (inList) output.push("</ol>");

  return output.join("");
}
