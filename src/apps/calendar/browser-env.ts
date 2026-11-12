// SPDX-License-Identifier: AGPL-3.0-or-later
/** The browser side of the Calendar mode: runtime loader with its pin check, viewer, planner, fonts and the print link. */
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
import pin from "../../../calendar-source.json";
import { CalendarViewer } from "./viewer.ts";
import { CalendarOptimizer, solverTimeoutMs } from "./optimizer.ts";
import { demand, validateDesign, type Design } from "./model.ts";
import type { CalendarEnv } from "./mount.ts";

const WEIGHTS = [600, 800];

export function browserCalendarEnv(base: string, controls: HTMLElement): CalendarEnv {
  const prefix = deploymentBasePath(base);
  return {
    controls,
    async loadDesign(id: string): Promise<Design> {
      const response = await fetch(`${prefix}calendar/${id}.json`);
      demand(response.ok, "Unable to load the verified calendar");
      const bytes = await response.arrayBuffer();
      demand(
        bytes.byteLength < 2_000_000 &&
          (await sha256(new Uint8Array(bytes))) === (pin.runtime as Record<string, string>)[id + ".json"],
        "Calendar integrity mismatch",
      );
      return validateDesign(JSON.parse(new TextDecoder().decode(bytes)));
    },
    now: () => Date.now(),
    async fontsReady() {
      await Promise.all(WEIGHTS.map((weight) => document.fonts.load(`${weight} 168px "Counter Sans"`)));
      demand(
        WEIGHTS.every((weight) => document.fonts.check(`${weight} 168px "Counter Sans"`)),
        "Calendar font unavailable",
      );
    },
    createViewer: (host) => new CalendarViewer(host),
    // Internal test hook (Pages tests on slow runners); unset in production.
    createOptimizer: () => new CalendarOptimizer(undefined, solverTimeoutMs((window as any).__calendarSolverTimeoutMs)),
    every(fn, ms) {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    },
    onResume(fn) {
      document.addEventListener("visibilitychange", fn);
      window.addEventListener("pageshow", fn);
      return () => {
        document.removeEventListener("visibilitychange", fn);
        window.removeEventListener("pageshow", fn);
      };
    },
    later: (fn, ms) => void setTimeout(fn, ms),
    setPrintDesign(design) {
      const link = document.getElementById("print-stickers") as HTMLAnchorElement | null;
      if (link) link.href = new URL(`print.html?design=${design}`, location.href).href;
    },
    expose(name, value) {
      if (value === undefined) delete (window as any)[name];
      else (window as any)[name] = value;
    },
  };
}
