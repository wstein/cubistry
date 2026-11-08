// A small DOM stand-in for node tests of the shell API (the repo has no jsdom). It implements only what
// src/apps/shell/ uses and counts every mutation in `log`, so tests can assert that nothing is written needlessly.

export class FakeElement {
  constructor(tag, log, ownerDocument = null) {
    this.tagName = tag.toUpperCase();
    this.log = log;
    this.ownerDocument = ownerDocument;
    this.scrollTop = 0;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.className = "";
    this.id = "";
    this._attrs = new Map();
    this._text = "";
    this._hidden = false;
    this._listeners = new Map();
  }
  get parentElement() {
    return this.parentNode;
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(v) {
    this.log.push(["hidden", this, !!v]);
    this._hidden = !!v;
  }
  get textContent() {
    return this._text + this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join("");
  }
  set textContent(v) {
    this.log.push(["text", this, String(v)]);
    this._detachAll();
    this._text = String(v);
  }
  setAttribute(k, v) {
    this.log.push(["attr", this, k, String(v)]);
    this._attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this._attrs.has(k) ? this._attrs.get(k) : null;
  }
  removeAttribute(k) {
    this.log.push(["attr-", this, k]);
    this._attrs.delete(k);
  }
  hasAttribute(k) {
    return this._attrs.has(k);
  }
  _detachAll() {
    // A browser blurs a focused element that leaves the document.
    const doc = this.ownerDocument;
    if (doc?.activeElement && this.contains(doc.activeElement) && doc.activeElement !== this) doc.activeElement = null;
    for (const c of this.children) if (typeof c !== "string") c.parentNode = null;
    this.scrollTop = 0; // replaced content resets the scroll position, as it does when the content shrinks
    this.children = [];
    this._text = "";
  }
  append(...nodes) {
    this.log.push(["append", this, nodes.length]);
    for (const n of nodes) {
      if (typeof n !== "string") {
        n.remove?.();
        n.parentNode = this;
      }
      this.children.push(n);
    }
  }
  replaceChildren(...nodes) {
    this.log.push(["replace", this, nodes.length]);
    this._detachAll();
    for (const n of nodes) {
      if (typeof n !== "string") {
        n.remove?.();
        n.parentNode = this;
      }
      this.children.push(n);
    }
  }
  contains(node) {
    return node === this || this.descendants().includes(node);
  }
  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }
  remove() {
    if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null;
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
    this.parentNode = null;
  }
  addEventListener(type, fn) {
    const set = this._listeners.get(type) ?? new Set();
    set.add(fn);
    this._listeners.set(type, set);
  }
  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }
  listenerCount(type) {
    return this._listeners.get(type)?.size ?? 0;
  }
  fire(type) {
    for (const fn of [...(this._listeners.get(type) ?? [])]) fn({ type, target: this });
  }
  click() {
    this.fire("click");
  }
  /** All descendant elements, depth first. */
  descendants() {
    return this.children.flatMap((c) => (typeof c === "string" ? [] : [c, ...c.descendants()]));
  }
  find(pred) {
    return this.descendants().find(pred);
  }
}

export class FakeDocument {
  constructor() {
    this.log = [];
    this.activeElement = null;
  }
  createElement(tag) {
    return new FakeElement(tag, this.log, this);
  }
  /** Writes since the last call; ignores nothing. */
  drain() {
    return this.log.splice(0);
  }
}

/** The elements of index.html that the shell API drives, hidden like the markup has them. */
export function fakeRegions() {
  const doc = new FakeDocument();
  const el = (tag, hidden = true) => {
    const e = doc.createElement(tag);
    e._hidden = hidden;
    return e;
  };
  const slots = {};
  for (const n of [1, 2, 3, 4, 5]) {
    slots[n] = el("section");
    slots[n].dataset.slot = String(n);
  }
  const regions = {
    status: el("div", false),
    primary: el("div"),
    slots,
    readout: el("div"),
    nerd: el("div"),
    nerdToggle: el("button"),
    hints: el("div"),
    reference: el("button"),
  };
  regions.nerd.id = "shell-nerd";
  doc.drain();
  return { doc, regions };
}
