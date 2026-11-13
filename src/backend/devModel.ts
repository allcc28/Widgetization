// Dev stand-in for the model until Role II's client exists. Appends "(revised)" to each requested node,
// in the working output shape, so the real validation path runs in the app.
import type { ModelFn } from "./api";

export const devModel: ModelFn = async ({ state, ids }) => {
  await new Promise((r) => setTimeout(r, 800));
  const nodes = Object.fromEntries(
    ids.map((id) => {
      const c = state.nodes[id].content;
      return [id, { content: "summary" in c ? { summary: `${c.summary} (revised)` } : { ...c, backstory: `${c.backstory} (revised)` } }];
    }),
  );
  return JSON.stringify({ nodes });
};
