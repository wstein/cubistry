// Worker entry: sanitizes and cuts one SVG upload off the main thread (see svg-faces.ts).
import { SvgRejected } from "@cubistry/cube-assets";
import { cutSvgNet, prepareSvgFace, type SvgJob, type SvgJobReply } from "./svg-faces.ts";

const scope = globalThis as unknown as {
  onmessage: ((e: { data: SvgJob }) => void) | null;
  postMessage: (reply: SvgJobReply) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ ok: true, result: data.op === "net" ? cutSvgNet(data.text) : prepareSvgFace(data.text) });
  } catch (e) {
    scope.postMessage({
      ok: false,
      rejected: e instanceof SvgRejected,
      message: e instanceof Error ? e.message : "The SVG could not be processed",
    });
  }
};
