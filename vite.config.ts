/// <reference types="node" />
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { generateContent } from "./src/backend/ollamaClient";
import type { GenerationRequest } from "./src/backend/prompts";

/** Dev-only: one line per event, `[widget] <applyId>#<attempt> <event> {fields}`. */
function print(id: unknown, event: unknown, fields: Record<string, unknown>): void {
  console.log(`[widget] ${String(id || "-")} ${String(event)} ${JSON.stringify(fields)}`);
}

function localGenerationApi(): Plugin {
  return {
    name: "local-generation-api",

    configureServer(server) {
      // Events from src/backend/api.ts, which runs in the browser.
      server.ws.on("widget:log", (data: Record<string, unknown>) => {
        const { id, event, ...fields } = data ?? {};
        print(id, event, fields);
      });

      server.middlewares.use("/api/generate", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Use POST for this endpoint." }));
          return;
        }

        const controller = new AbortController();
        const cancel = () => controller.abort();
        const onClose = () => {
          if (!res.writableEnded) cancel();
        };
        req.once("aborted", cancel);
        res.once("close", onClose);

        try {
          req.setEncoding("utf8");
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 100_000) {
              res.statusCode = 413;
              res.end(JSON.stringify({ error: "Request is too large." }));
              return;
            }
          }

          const input = JSON.parse(body);
          if (
            !input?.state?.nodes ||
            !input.state.quest ||
            !["initial", "bounded", "baseline"].includes(input.mode) ||
            (input.mode !== "initial" && !input.edit)
          ) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid generation request." }));
            return;
          }

          const trace = req.headers["x-trace-id"];
          const log = (event: string, fields: Record<string, unknown> = {}) => print(trace, event, fields);
          const t = Date.now();
          log("server.request", { mode: input.mode, card: input.edit?.cardId, param: input.edit?.param });
          const result = await generateContent(input as GenerationRequest, controller.signal, log);
          if (controller.signal.aborted || res.destroyed) {
            log("server.aborted", { ms: Date.now() - t });
            return;
          }
          res.statusCode = result.ok ? 200
            : result.error.code === "INVALID_EDIT" ? 400
            : result.error.code === "TIMEOUT" ? 504
            : 502;
          log("server.result", { status: res.statusCode, ok: result.ok, ...(result.ok ? {} : { code: result.error.code }), ms: Date.now() - t });
          res.end(JSON.stringify(result));
        } catch (error) {
          if (controller.signal.aborted || res.destroyed) {
            print(req.headers["x-trace-id"], "server.aborted", {});
            return;
          }
          res.statusCode = error instanceof SyntaxError ? 400 : 500;
          res.end(JSON.stringify({
            error: error instanceof SyntaxError
              ? "Invalid JSON request."
              : "Generation request failed.",
          }));
        } finally {
          req.off("aborted", cancel);
          res.off("close", onClose);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localGenerationApi()],
  test: { include: ["tests/**/*.test.ts"] },
});