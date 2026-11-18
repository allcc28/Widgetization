import type { ModelFn } from "./api";

export const ollamaModel: ModelFn = async (request, signal) => {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      mode: request.mode,
      state: request.before,
      edit: request.edit,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.ok !== true) {
    const message =
      typeof result.error === "string"
        ? result.error
        : result.error?.message;

    throw new Error(message ?? `Generation failed (HTTP ${response.status}).`);
  }

  return JSON.stringify({ nodes: result.nodes });
};
