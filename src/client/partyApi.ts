import { applyParam, isEditAllowed } from "../shared/applyParam";
import { affectedSet } from "../shared/dependencies";
import { withDerived } from "../shared/derived";
import { diff } from "../shared/diff";
import { NODE_IDS, type Condition, type Edit, type ErrorCode, type State, type UpdateResult } from "../shared/types";
import type { FullPartyOutput } from "../backend/modelOutput";

const history: State[] = [];
export const canUndo = () => history.length > 0;
export const undo = () => history.pop() ?? null;
export function resetHistory() { history.length = 0; }

async function update(mode: Condition, state: State, edit: Edit): Promise<UpdateResult> {
  const start = Date.now();
  const fail = (code: ErrorCode, message: string): UpdateResult =>
    ({ ok: false, state, error: { code, message }, latencyMs: Date.now() - start });
  if (!isEditAllowed(state, edit)) return fail("INVALID_EDIT", "Invalid edit.");
  const affected = affectedSet(edit);
  if (state.nodes[edit.cardId].params[edit.param] === edit.value) {
    return { ok: true, state, affected, changed: [], latencyMs: 0 };
  }
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, state, edit }),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) {
      const err = result?.error;
      return fail(err?.code ?? "MODEL_ERROR", err?.message ?? "Generation failed.");
    }
    const expected = mode === "bounded" ? affected : NODE_IDS;
    const raw = result.nodes;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail("SCHEMA_MISMATCH", "Missing nodes.");
    }
    if (Object.keys(raw).some(id => !expected.some(key => key === id))) {
      return fail("OFF_SCOPE_ID", "Unexpected node.");
    }
    const next = applyParam(state, edit);
    for (const id of expected) {
      const c = raw[id]?.content;
      if (id === "overview") {
        if (typeof c?.summary !== "string" || !c.summary.trim()) return fail("SCHEMA_MISMATCH", "Invalid summary.");
        next.nodes.overview = { ...next.nodes.overview, content: { summary: c.summary } };
      } else {
        if (typeof c?.backstory !== "string" || !c.backstory.trim() ||
            !Array.isArray(c.abilities) || !c.abilities.length ||
            !c.abilities.every((v: unknown) => typeof v === "string" && v.trim().length > 0)) {
          return fail("SCHEMA_MISMATCH", "Invalid hero content.");
        }
        const content: FullPartyOutput["nodes"][typeof id]["content"] =
          { backstory: c.backstory, abilities: [...c.abilities] };
        next.nodes[id] = { ...next.nodes[id], content };
      }
    }
    const committed = withDerived(next);
    const changed = diff(state, committed);
    history.push(state);
    return { ok: true, state: committed, affected, changed, latencyMs: Date.now() - start };
  } catch {
    return fail("MODEL_ERROR", "Could not read the generation response.");
  }
}

export const applyEdit = (state: State, edit: Edit) => update("bounded", state, edit);
export const regenerateAll = (state: State, edit: Edit) => update("baseline", state, edit);
