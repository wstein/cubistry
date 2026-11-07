/**
 * Builders for the content of the Nerd drawer (`ModeShell.setNerd`). The drawer is for numbers that explain the run
 * (timing, session statistics, the committed-moves table), not for controls.
 */

type Doc = Pick<Document, "createElement">;

export interface NerdTableSpec {
  caption: string;
  columns: readonly string[];
  /** Each row starts with its row header (for example the cube name). */
  rows: readonly (readonly string[])[];
}

function cell(doc: Doc, tag: "th" | "td", text: string, scope?: "col" | "row"): HTMLElement {
  const el = doc.createElement(tag);
  el.textContent = text;
  if (scope) el.setAttribute("scope", scope);
  return el;
}

/** A captioned table; column headers have `scope="col"`, the first cell of each row is a `scope="row"` header. */
export function nerdTable(doc: Doc, spec: NerdTableSpec): HTMLElement {
  const table = doc.createElement("table");
  table.className = "shell-nerd-table";
  const caption = doc.createElement("caption");
  caption.textContent = spec.caption;
  const headRow = doc.createElement("tr");
  headRow.append(...spec.columns.map((c) => cell(doc, "th", c, "col")));
  const thead = doc.createElement("thead");
  thead.append(headRow);
  const tbody = doc.createElement("tbody");
  spec.rows.forEach((row, i) => {
    if (row.length !== spec.columns.length) throw new RangeError(`row ${i} has ${row.length} cells for ${spec.columns.length} columns`);
    const tr = doc.createElement("tr");
    tr.append(...row.map((text, j) => (j === 0 ? cell(doc, "th", text, "row") : cell(doc, "td", text))));
    tbody.append(tr);
  });
  table.append(caption, thead, tbody);
  return table;
}

/** A definition list of label/value pairs, such as "Tolerance: 20 ms". */
export function nerdFacts(doc: Doc, facts: readonly (readonly [string, string])[]): HTMLElement {
  const list = doc.createElement("dl");
  list.className = "shell-nerd-facts";
  for (const [label, value] of facts) {
    const dt = doc.createElement("dt");
    dt.textContent = label;
    const dd = doc.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  }
  return list;
}
