/// <reference types="node" />
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { generateContent } from "./src/backend/ollamaClient";
import type { GenerationRequest } from "./src/backend/prompts";

function localGenerationApi(): Plugin {
  return {
    name: "local-generation-api",

    configureServer(server) {
      server.middlewares.use("/api/generate", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Use POST for this endpoint." }));
          return;
        }

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

          const result = await generateContent(input as GenerationRequest);
          res.statusCode = result.ok ? 200
            : result.error.code === "INVALID_EDIT" ? 400
            : result.error.code === "TIMEOUT" ? 504
            : 502;
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = error instanceof SyntaxError ? 400 : 500;
          res.end(JSON.stringify({
            error: error instanceof SyntaxError
              ? "Invalid JSON request."
              : "Generation request failed.",
          }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localGenerationApi()],
  test: { include: ["tests/**/*.test.ts"] },
});