import { CubeViewer } from "@cubistry/cube-viewer";
import { loadAssets } from "@cubistry/cube-assets";
import { stateEquals, type CubeState } from "@cubistry/cube-core";
import { parseAlg, presentMove, matchesTarget } from "@cubistry/cube-mechanics";
import { acceptanceFixture } from "../../src/dev/acceptance-fixture.ts";
import { targetFor } from "../../src/apps/counter/design.ts";
const host = document.querySelector<HTMLDivElement>("#cube")!,
  status = document.querySelector<HTMLElement>("#status")!,
  solve = document.querySelector<HTMLButtonElement>("#solve")!,
  goal = document.querySelector<HTMLSelectElement>("#goal")!,
  result = document.querySelector<HTMLElement>("#result")!;
const viewer = new CubeViewer(host);
document
  .querySelector("#camera")!
  .addEventListener("click", () => viewer.resetCamera());
let state: CubeState;
try {
  const fixture = acceptanceFixture(
      await (
        await fetch(`${import.meta.env.BASE_URL}counter-design.v2.json`)
      ).json(),
    ),
    assets = await loadAssets(
      fixture.design.assets,
      [fixture.print],
      undefined,
      import.meta.env.BASE_URL,
    );
  state = fixture.start;
  viewer.configure(fixture.print, state, assets);
  host.dataset.ready = "true";
  // The production counter remains a separate fast prerecorded-witness consumer.
  // This page alone calls the dev-only live backend at value selection.
  const dev = import.meta.env.DEV;
  status.textContent = dev
    ? "Choose a target to call the existing solver."
    : "Live solver calls are development-only. Run npm run dev to use this check.";
  solve.disabled = !dev;
  solve.addEventListener("click", async () => {
    solve.disabled = true;
    goal.disabled = true;
    host.dataset.verified = "false";
    result.textContent = "";
    status.textContent = "Calling the existing cubing solver…";
    try {
      const value = Number(goal.value);
      state = fixture.start;
      viewer.configure(fixture.print, state, assets);
      viewer.resetCamera();
      const response = await fetch("/api/m1/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Live solver request failed");
      if (
        data.schema !== "cubistry.live-solver-result" ||
        data.version !== 1 ||
        data.value !== value ||
        data.solverInvocations !== 2 ||
        typeof data.word !== "string"
      )
        throw Error("Unsupported live solver response");
      const moves = parseAlg(data.word);
      if (moves.length > 128) throw Error("Solver response exceeds move limit");
      status.textContent = "Executing solver moves on physical cubies…";
      for (const move of moves) {
        const presentation = presentMove(state, move);
        await viewer.animate(presentation);
        state = presentation.to;
      }
      if (
        !stateEquals(state, fixture.goal(value)) ||
        !stateEquals(state, viewer.presentedState!) ||
        !matchesTarget(fixture.print, state, targetFor(value, true))
      )
        throw Error(
          "Executed result does not match the full state and upright display target",
        );
      host.dataset.value = String(value);
      host.dataset.verified = "true";
      status.textContent = `Verified ${String(value).padStart(2, "0")}: complete state and upright sticker target.`;
      result.textContent = `${data.backend.id}@${data.backend.version}\n2 actual complete-state solver calls; optimality unknown\n${data.word}`;
      // A read-only debugging snapshot supports inspection; pixels are tested separately.
      Object.defineProperty(window, "acceptanceState", {
        value: state,
        configurable: true,
        writable: false,
      });
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Solver check failed";
      host.dataset.verified = "false";
    } finally {
      solve.disabled = !dev;
      goal.disabled = false;
    }
  });
  addEventListener(
    "pagehide",
    () => {
      viewer.destroy();
      assets.dispose();
    },
    { once: true },
  );
} catch (error) {
  status.textContent =
    error instanceof Error ? error.message : "Could not load acceptance design";
}
