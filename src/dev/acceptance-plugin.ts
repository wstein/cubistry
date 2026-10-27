/** Local-development acceptance harness only; never a production API. */
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { createCubing2x2Adapter } from "../adapters/cubing-2x2.ts";
import { acceptanceFixture, GOAL_VALUES } from "./acceptance-fixture.ts";
export function solverAcceptancePlugin(): Plugin {
  let pending = false,
    adapter: ReturnType<typeof createCubing2x2Adapter> | undefined;
  return {
    name: "local-m1-solver-acceptance",
    apply: "serve",
    configureServer(server) {
      const fixture = acceptanceFixture(
        JSON.parse(
          readFileSync(
            new URL("../../public/counter-design.v2.json", import.meta.url),
            "utf8",
          ),
        ),
      );
      server.middlewares.use(
        "/api/m1/solve",
        async (req: IncomingMessage, res: ServerResponse) => {
          const send = (status: number, payload: unknown) => {
            if (!res.writableEnded) {
              res.writeHead(status, {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              });
              res.end(JSON.stringify(payload));
            }
          };
          if (req.method !== "POST") {
            send(405, { error: "Use POST for this local acceptance check" });
            return;
          }
          const host = req.headers.host ?? "",
            origin = req.headers.origin,
            site = req.headers["sec-fetch-site"];
          let local = false;
          try {
            const u = new URL("http://" + host);
            local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
          } catch {}
          if (
            !local ||
            (origin !== undefined && origin !== "http://" + host) ||
            (site !== undefined && site !== "same-origin" && site !== "none")
          ) {
            send(403, {
              error:
                "This acceptance endpoint accepts same-origin localhost requests only",
            });
            return;
          }
          if (
            req.headers["content-type"]?.split(";")[0].trim() !==
            "application/json"
          ) {
            send(415, { error: "Expected application/json" });
            return;
          }
          if (pending) {
            send(409, {
              error:
                "A solver check is already running; retry when it finishes",
            });
            return;
          }
          let body: unknown;
          try {
            body = await new Promise<string>((resolve, reject) => {
              let text = "",
                bytes = 0;
              const timer = setTimeout(
                () => reject(Error("Request body timeout")),
                2000,
              );
              req.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > 64) {
                  clearTimeout(timer);
                  reject(Error("Request exceeds 64 bytes"));
                  return;
                }
                text += chunk.toString("utf8");
              });
              req.on("end", () => {
                clearTimeout(timer);
                resolve(text);
              });
              req.on("error", (e) => {
                clearTimeout(timer);
                reject(e);
              });
            });
            body = JSON.parse(body as string);
          } catch (e) {
            send(400, {
              error: e instanceof Error ? e.message : "Invalid JSON request",
            });
            return;
          }
          if (
            body === null ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !Object.hasOwn(body, "value") ||
            typeof (body as { value?: unknown }).value !== "number" ||
            !GOAL_VALUES.some((v) => v === (body as { value: number }).value)
          ) {
            send(400, {
              error: "Expected exactly one numeric value: 0, 7, 42, 58, or 99",
            });
            return;
          }
          // Recheck after body collection: concurrent bodies cannot both start work.
          if (pending) {
            send(409, { error: "A solver check is already running" });
            return;
          }
          pending = true;
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            const value = (body as { value: number }).value;
            const task = (async () => {
              adapter ??= createCubing2x2Adapter();
              return (await adapter).solveBetween(
                fixture.print,
                fixture.start,
                fixture.goal(value),
              );
            })();
            // A timeout does not cancel cubing's worker CPU. Keep the single-flight
            // lock until it settles; do not spawn an unbounded queue of background jobs.
            void task
              .finally(() => {
                pending = false;
              })
              .catch(() => {});
            const result = await Promise.race([
              task,
              new Promise<never>((_, reject) => {
                timeout = setTimeout(
                  () =>
                    reject(
                      Error(
                        "Existing solver exceeded the 30-second acceptance budget",
                      ),
                    ),
                  30000,
                );
              }),
            ]);
            send(200, { ...result, value });
          } catch (e) {
            send(503, {
              error:
                e instanceof Error
                  ? e.message
                  : "Existing solver failed; no moves applied",
            });
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        },
      );
    },
  };
}
