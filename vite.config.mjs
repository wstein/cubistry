import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { solverAcceptancePlugin } from "./src/dev/acceptance-plugin.ts";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  // Keep module-relative provider assets available in development and builds.
  optimizeDeps: {
    exclude: ["@puzlwerk/solver-2x2", "@puzlwerk/solver-3x3-picture", "cubing"],
  },
  assetsInclude: ["**/*.bin"],
  plugins: [solverAcceptancePlugin()],
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        // cubing's nested search entry shares its API with the outer worker.
        // Keep that API in a vendor chunk so importing it never reruns the
        // calendar worker's onmessage handler inside the nested solver worker.
        manualChunks(id) {
          if (
            id.includes("/node_modules/") &&
            !/\/(?:search-worker-entry|inside-[^/]+)\.js$/.test(id)
          )
            return "calendar-solver-vendor";
        },
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        picture3: fileURLToPath(new URL("./picture3.html", import.meta.url)),
        playground: fileURLToPath(new URL("./playground.html", import.meta.url)),
        status: fileURLToPath(new URL("./status.html", import.meta.url)),
        print: fileURLToPath(new URL("./print.html", import.meta.url)),
        calendar: fileURLToPath(new URL("./calendar.html", import.meta.url)),
        clock: fileURLToPath(new URL("./clock.html", import.meta.url)),
        msTimer: fileURLToPath(new URL("./ms-timer.html", import.meta.url)),
        counter: fileURLToPath(new URL("./index.html", import.meta.url)),
        acceptance: fileURLToPath(
          new URL("./solver-acceptance.html", import.meta.url),
        ),
        library: fileURLToPath(
          new URL("./library-example.html", import.meta.url),
        ),
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
