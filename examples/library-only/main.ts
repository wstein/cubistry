import { parseDesignState, loadAssets } from "@cubistry/cube-assets";
import { CubeViewer } from "@cubistry/cube-viewer";
import { stateEquals } from "@cubistry/cube-core";
import { parseMove, presentMove } from "@cubistry/cube-mechanics";
const host = document.querySelector<HTMLElement>("#cube")!,
  status = document.querySelector<HTMLElement>("#status")!,
  turn = document.querySelector<HTMLButtonElement>("#turn")!,
  inverse = document.querySelector<HTMLButtonElement>("#inverse")!;
try {
  const response = await fetch(
    `${import.meta.env.BASE_URL}examples/library-design.json`,
  );
  if (!response.ok) throw Error("Independent design could not be loaded");
  const {
      print,
      state: source,
      assets,
    } = await parseDesignState(await response.text()),
    loaded = await loadAssets(
      assets,
      [print],
      undefined,
      import.meta.env.BASE_URL,
    ),
    viewer = new CubeViewer(host);
  let state = source;
  viewer.configure(print, state, loaded);
  host.dataset.ready = "true";
  host.dataset.atSource = "true";
  turn.disabled = false;
  inverse.disabled = false;
  status.textContent = "Loaded independent color, image and text stickers.";
  const move = async (notation: string) => {
    turn.disabled = true;
    inverse.disabled = true;
    try {
      const presentation = presentMove(state, parseMove(notation));
      await viewer.animate(presentation);
      state = presentation.to;
      if (!stateEquals(state, viewer.presentedState!))
        throw Error("Viewer diverged from shared mechanics");
      host.dataset.atSource = String(stateEquals(state, source));
      status.textContent = stateEquals(state, source)
        ? "Exact source restored, including all sticker frames."
        : "Legal R move presented by the shared viewer.";
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : "Move failed";
    } finally {
      turn.disabled = false;
      inverse.disabled = false;
    }
  };
  turn.addEventListener("click", () => void move("R"));
  inverse.addEventListener("click", () => void move("R'"));
  addEventListener(
    "pagehide",
    () => {
      viewer.destroy();
      loaded.dispose();
    },
    { once: true },
  );
} catch (e) {
  status.textContent =
    e instanceof Error ? e.message : "Library example failed";
}
