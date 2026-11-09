// SPDX-License-Identifier: AGPL-3.0-or-later
/** One notation plan per animation plan. Generator expansions describe equivalent
 * slab turns; they never invent a generator for the physical middle layer. */
import { blockCounts, blockToken, expandBlock, type Block } from "./blocks.ts";
import { alignmentText, playedBlocks, type RotationPlacement } from "./deferral.ts";
import { generatorAxis, generatorLayer, isRotation, type Move } from "./engine.ts";
export type Notation = "blocks" | "layers" | "raw";
export interface WordOptions { readonly orientation: RotationPlacement; readonly slice: boolean; readonly notation: Notation }
export const DEFAULT_WORD_OPTIONS: WordOptions = { orientation: "before", slice: true, notation: "blocks" };
const AXES = ["x", "y", "z"];
export function moveToken([g, q]: Move): string {
  const layer = isRotation(g) ? "rot" : `${generatorLayer(g) > 0 ? "+" : ""}${generatorLayer(g)}`;
  return `${AXES[generatorAxis(g)]}${layer}${q === -1 ? "'" : q === 2 ? "²" : ""}`;
}
export const rawToken = ([g, q]: Move): string => `g${g}:${q === 1 ? "+1" : q === -1 ? "-1" : "2"}`;
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
export interface TokenGroup {
  readonly index: number;
  readonly free: boolean;
  readonly tokens: readonly { text: string; free: boolean }[];
}
export interface NotationPlan {
  readonly groups: readonly TokenGroup[];
  readonly completedMoves: readonly number[];
  /** Actual animated nonrotation blocks, independent of notation. */
  readonly moves: number;
  /** Equivalent 21-generator layer turns, not a count of animations. */
  readonly expandedLayerMoves: number;
}
export function notationForBlocks(blocks: readonly Block[], notation: Notation): NotationPlan {
  let expandedLayerMoves = 0;
  const groups = blocks.map((b, index): TokenGroup => {
    const expansion = expandBlock(b);
    expandedLayerMoves += expansion.filter(([g]) => !isRotation(g)).length;
    return { index, free: b.kind === "rotation", tokens: notation === "blocks"
      ? [{ text: blockToken(b), free: b.kind === "rotation" }]
      : expansion.map((m) => ({ text: notation === "raw" ? rawToken(m) : moveToken(m), free: isRotation(m[0]) })) };
  });
  const completedMoves = [0];
  for (const group of groups) completedMoves.push(completedMoves.at(-1)! + (group.free ? 0 : 1));
  return { groups, completedMoves, moves: blockCounts(blocks).blockMoves, expandedLayerMoves };
}
export function notationHtml(plan: NotationPlan): string {
  return plan.groups.map((g) => `<span class="c7-token-group" data-block="${g.index}"${g.free ? ' data-free="true"' : ""}>` +
    g.tokens.map((t) => `<span class="c7-tok${t.free ? " c7-free" : ""}">${esc(t.text)}${t.free ? '<span class="c7-free-mark"> (free)</span>' : ""}</span>`).join(" ") + "</span>").join(" ");
}
export const notationLabel = (notation: Notation): string => notation === "blocks" ? "Blocks" : notation === "layers" ? "Layer moves (equivalent expansion)" : "Raw generators (equivalent expansion)";
export const expansionNote = (notation: Notation): string => notation === "blocks" ? "Each highlighted group is one animated turn." :
  "Equivalent expansion into generators 1–21. Each highlighted group plays as one block; rotations inside an expansion are algebraic, not separate animations.";
export function orientationLabel(moves: readonly Move[], placement: RotationPlacement): string {
  if (placement === "stored") return "Whole-cube rotations stay in the word (free).";
  const text = alignmentText(moves);
  return text === "none" ? "Orientation: none." : `Orientation ${placement === "before" ? "before moves" : "at the end"} (free): ${text}.`;
}
export function stepNotation(word: readonly Move[], options: WordOptions) {
  const played = playedBlocks(word, options);
  return { ...notationForBlocks(played.blocks, options.notation), played };
}
/** Progress follows animation blocks, so an equivalent expansion is highlighted as a group. */
const progressCache = new WeakMap<HTMLElement, { first: Element | null; groups: HTMLElement[]; done: number; current: HTMLElement | null }>();
export function markProgress(container: HTMLElement, done: number, active: boolean, follow: boolean): void {
  let cache = progressCache.get(container);
  if (!cache || cache.first !== container.firstElementChild) {
    cache = { first: container.firstElementChild, groups: Array.from(container.querySelectorAll<HTMLElement>("[data-block]")), done: 0, current: null };
    progressCache.set(container, cache);
  }
  for (let i = Math.min(cache.done, done); i < Math.max(cache.done, done); i++)
    cache.groups[i]?.classList.toggle("c7-past", i < done);
  const current = active ? cache.groups[done] ?? null : null;
  if (current !== cache.current) {
    cache.current?.classList.remove("c7-current");
    cache.current?.removeAttribute("aria-current");
    current?.classList.add("c7-current");
    current?.setAttribute("aria-current", "step");
  }
  const changed = current !== cache.current;
  cache.done = done; cache.current = current;
  // Only this bounded word box scrolls. No document scroll, focus change or smooth motion.
  if (current && follow && changed) {
    const box = container.getBoundingClientRect(), token = current.getBoundingClientRect();
    if (token.top < box.top) container.scrollTop -= box.top - token.top;
    else if (token.bottom > box.bottom) container.scrollTop += token.bottom - box.bottom;
  }
}
