import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { solverAcceptancePlugin } from "./src/dev/acceptance-plugin.ts";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  // Keep module-relative provider assets available in development and builds.
  optimizeDeps: { exclude: ["@puzlwerk/solver-2x2", "cubing"] },
  assetsInclude: ["**/*.bin"],
  plugins: [solverAcceptancePlugin()],
  worker: { format: "es" },
  build: {
    rollupOptions: {
      input: {
        calendar: fileURLToPath(new URL("./calendar.html", import.meta.url)),
        clock: fileURLToPath(new URL("./clock.html", import.meta.url)),
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
