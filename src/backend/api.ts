// Role III: the real backend. Same signatures as fakeApi.ts (contracts.md 2.4-2.6).
// The model is pluggable (setModel) so Role II drops in without changing this file's interface.

import { applyParam, isEditAllowed } from "../shared/applyParam";
import { affectedSet } from "../shared/dependencies";
import { withDerived } from "../shared/derived";
import { diff } from "../shared/diff";
import { NODE_IDS, type Condition, type Edit, type ErrorCode, type NodeId, type State, type UpdateError, type UpdateResult } from "../shared/types";
import { devModel } from "./devModel";
import { checkOutput, parseOutput, type Content } from "./validate";

/** `state` is the post-edit state (new params, old content, recomputed derived); `before` is the state before the edit; `ids` are the nodes to return. */
export interface ModelRequest {
  mode: Condition;
  state: State;
  before: State;
  edit: Edit;
  ids: NodeId[];
  /** Dev-only correlation id, "<applyId>#<attempt>"; for logs, never for generation. */
  traceId?: string;
}
/** Returns the model's raw text. Throw for network/API failure; stop on `signal` abort (timeout). */
export type ModelFn = (req: ModelRequest, signal: AbortSignal) => Promise<string>;

const ATTEMPTS = 2; // one internal retry
const DEFAULT_TIMEOUT_MS = 20_000; // per attempt; confirm with Role II
let model: ModelFn = devModel;
let timeoutMs = DEFAULT_TIMEOUT_MS;
const history: State[] = [];
// Codes a model client may pass through on a thrown error; anything else is MODEL_ERROR.
const PASSED = new Set<unknown>(["TIMEOUT", "INVALID_JSON", "SCHEMA_MISMATCH", "OFF_SCOPE_ID", "INVALID_EDIT"] satisfies ErrorCode[]);

/** Dev-only: sends one structured event to the `npm run dev` terminal (no-op in builds and tests). */
function devLog(id: string, event: string, fields: Record<string, unknown> = {}): void {
  import.meta.hot?.send("widget:log", { id, event, ...fields });
}
/** Error text for logs: capped, and never the JSON parser's message (it quotes model output). */
const reason = (e: UpdateError) => (e.code === "INVALID_JSON" ? "not JSON" : e.message.slice(0, 100));

/** Plug in the model (Role II's client, or a scripted fake in tests). */
export function setModel(fn: ModelFn, timeout = DEFAULT_TIMEOUT_MS): void {
  model = fn;
  timeoutMs = timeout;
}

async function callModel(req: ModelRequest): Promise<string | UpdateError> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<UpdateError>((resolve) => {
    timer = setTimeout(() => {
      resolve({ code: "TIMEOUT", message: `No model answer within ${timeoutMs} ms.` }); // before abort, so it wins the race
      ctrl.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([model(req, ctrl.signal), timeout]);
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    return { code: PASSED.has(code) ? (code as ErrorCode) : "MODEL_ERROR", message: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Writes validated content onto the affected nodes only; every other node is carried over untouched. */
function commit(base: State, content: Partial<Record<NodeId, Content>>): State {
  const nodes = { ...base.nodes };
  for (const [id, c] of Object.entries(content) as [NodeId, Content][]) nodes[id] = { ...nodes[id], content: c } as never;
  return { ...base, nodes };
}

async function run(mode: Condition, state: State, edit: Edit): Promise<UpdateResult> {
  const id = crypto.randomUUID().slice(0, 8);
  const from = state.nodes[edit.cardId]?.params[edit.param];
  devLog(id, "apply.start", { mode, card: edit.cardId, param: edit.param, from, to: edit.value });
  const r = await runOnce(mode, state, edit, id);
  const changed = r.ok ? r.changed : [];
  const committed = r.ok && r.state !== state; // history is pushed exactly when a commit happens
  devLog(id, "apply.end", {
    ok: r.ok, ...(r.ok ? {} : { code: r.error.code, reason: reason(r.error) }),
    changed, preserved: NODE_IDS.filter((n) => !changed.includes(n)),
    committed, undoEntry: committed, undoDepth: history.length, ms: r.latencyMs,
  });
  return r;
}

async function runOnce(mode: Condition, state: State, edit: Edit, id: string): Promise<UpdateResult> {
  const start = Date.now();
  if (!isEditAllowed(state, edit)) {
    return { ok: false, state, error: { code: "INVALID_EDIT", message: "Edit not allowed (out of range or duplicate hero)." }, latencyMs: 0 };
  }
  const affected = affectedSet(edit);
  if (state.nodes[edit.cardId].params[edit.param] === edit.value) {
    return { ok: true, state, affected, changed: [], latencyMs: 0 };
  }

  const expected = withDerived(applyParam(state, edit));
  const ids = mode === "bounded" ? affected : [...NODE_IDS];
  let error!: UpdateError;
  for (let i = 0; i < ATTEMPTS; i++) {
    // Clones, so a misbehaving model client cannot mutate the caller's state.
    const raw = await callModel({ mode, state: structuredClone(expected), before: structuredClone(state), edit, ids, traceId: `${id}#${i + 1}` });
    const parsed = typeof raw === "string" ? parseOutput(raw) : { ok: false as const, error: raw };
    const checked = parsed.ok ? checkOutput(parsed.value, { expected, ids }) : parsed;
    devLog(id, "apply.attempt", { n: i + 1, ok: checked.ok, ...(checked.ok ? {} : { code: checked.error.code, reason: reason(checked.error) }) });
    if (checked.ok) {
      const next = commit(expected, checked.value);
      history.push(state);
      return { ok: true, state: next, affected, changed: diff(state, next), latencyMs: Date.now() - start };
    }
    error = checked.error;
  }
  return { ok: false, state, error, latencyMs: Date.now() - start };
}

/** Bounded condition: only affectedSet(edit) goes through the model. */
export function applyEdit(state: State, edit: Edit): Promise<UpdateResult> {
  return run("bounded", state, edit);
}

/** Baseline condition: the whole party is regenerated; `affected` is still the graph's set. */
export function regenerateAll(state: State, edit: Edit): Promise<UpdateResult> {
  return run("baseline", state, edit);
}

export function undo(): State | null {
  return history.pop() ?? null;
}
export function canUndo(): boolean {
  return history.length > 0;
}
export function resetHistory(): void {
  history.length = 0;
}
