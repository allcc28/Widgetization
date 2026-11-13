// Scripted fake model for Role III tests: plays one step per call (the last step repeats).
import type { ModelFn, ModelRequest } from "../src/backend/api";

type Step = string | Error | "hang" | ((req: ModelRequest) => string);

export function scripted(...steps: Step[]) {
  const calls: ModelRequest[] = [];
  const fn: ModelFn = (req, signal) => {
    calls.push(req);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    if (step instanceof Error) return Promise.reject(step);
    if (step === "hang") return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    return Promise.resolve(typeof step === "function" ? step(req) : step);
  };
  return { fn, calls };
}

/** A valid answer for every requested id, params and quest echoed; text of nodes in `revise` gets " (new)". */
export function answer(req: ModelRequest, revise: string[] = req.ids): string {
  const nodes = Object.fromEntries(
    req.ids.map((id) => {
      const n = req.state.nodes[id];
      const mark = (s: string) => (revise.includes(id) ? `${s} (new)` : s);
      return "params" in n
        ? [id, { params: n.params, content: { ...n.content, backstory: mark(n.content.backstory) } }]
        : [id, { content: { summary: mark(n.content.summary) } }];
    }),
  );
  return JSON.stringify({ nodes, quest: req.state.quest });
}

/** Like `answer`, then lets the test break one thing in the parsed object. */
export const tweak = (f: (o: any) => void) => (req: ModelRequest) => {
  const o = JSON.parse(answer(req));
  f(o);
  return JSON.stringify(o);
};
