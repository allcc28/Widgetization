import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEdit, canUndo, regenerateAll, resetHistory, setModel, undo } from "../src/backend/api";
import { ollamaModel } from "../src/backend/ollamaAdapter";
import { sampleState } from "../src/shared/sampleState";
import type { Edit, UpdateResult } from "../src/shared/types";
import { answer, scripted, tweak } from "./scriptedModel";

const edit: Edit = { cardId: "card_2", param: "power", value: 4 };
const offScope = (r: Extract<UpdateResult, { ok: true }>) => r.changed.filter((id) => !r.affected.includes(id));

function use(...steps: Parameters<typeof scripted>) {
  const m = scripted(...steps);
  setModel(m.fn, 50);
  return m;
}

beforeEach(() => resetHistory());
afterEach(() => vi.unstubAllGlobals());

describe("applyEdit (bounded)", () => {
  it("editing card_2 leaves card_1 and card_3 deep-equal; changed is within affected", async () => {
    const m = use(answer);
    const r = await applyEdit(sampleState, edit);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(m.calls[0]!.ids).toEqual(["card_2", "overview"]);
    expect(r.state.nodes.card_1).toEqual(sampleState.nodes.card_1);
    expect(r.state.nodes.card_3).toEqual(sampleState.nodes.card_3);
    expect(r.changed).toEqual(["card_2", "overview"]);
    expect(offScope(r)).toEqual([]);
    expect(r.state.nodes.card_2.params.power).toBe(4);
    expect(r.state.nodes.overview.derived.totalPower).toBe(15); // recomputed in code
    expect(r.state.quest).toEqual(sampleState.quest);
  });

  it("rejects a duplicate hero with INVALID_EDIT before any model call", async () => {
    const m = use(answer);
    const r = await applyEdit(sampleState, { cardId: "card_1", param: "cls", value: "Cleric" });
    expect(!r.ok && r.error.code).toBe("INVALID_EDIT");
    expect(r.state).toBe(sampleState);
    expect(m.calls).toHaveLength(0);
    expect(canUndo()).toBe(false);
  });

  it("a failed update returns the original state and pushes nothing", async () => {
    const before = structuredClone(sampleState);
    const m = use(tweak((o) => (o.nodes.card_1 = { content: sampleState.nodes.card_1.content })));
    const r = await applyEdit(sampleState, edit);
    expect(!r.ok && r.error.code).toBe("OFF_SCOPE_ID");
    expect(r.state).toBe(sampleState);
    expect(sampleState).toEqual(before);
    expect(m.calls).toHaveLength(2); // one retry
    expect(canUndo()).toBe(false);
  });

  it("retries once: a bad answer then a good one succeeds", async () => {
    const m = use("not json", answer);
    const r = await applyEdit(sampleState, edit);
    expect(r.ok).toBe(true);
    expect(m.calls).toHaveLength(2);
  });

  it("tags each model call with one apply id and its attempt number", async () => {
    const m = use("not json", answer);
    await applyEdit(sampleState, edit);
    const [a, b] = m.calls.map((c) => c.traceId);
    expect(a).toMatch(/^[0-9a-f]{8}#1$/);
    expect(b).toBe(a!.replace("#1", "#2"));
  });

  it("maps a thrown error to MODEL_ERROR", async () => {
    use(new Error("network down"));
    const r = await applyEdit(sampleState, edit);
    expect(!r.ok && r.error.code).toBe("MODEL_ERROR");
  });

  // Through the real adapter: the server's structured code survives, anything unknown is MODEL_ERROR.
  it.each([
    [504, { ok: false, error: { code: "TIMEOUT", message: "slow" } }, "TIMEOUT"],
    [502, { ok: false, error: { code: "SCHEMA_MISMATCH", message: "bad" } }, "SCHEMA_MISMATCH"],
    [502, { ok: false, error: { code: "NOT_A_CODE", message: "?" } }, "MODEL_ERROR"],
    [500, { error: "Generation request failed." }, "MODEL_ERROR"],
  ])("adapter HTTP %i keeps a known error code (%j -> %s); state and undo untouched", async (status, body, code) => {
    const send = vi.fn<typeof fetch>(async () => Response.json(body, { status }));
    vi.stubGlobal("fetch", send);
    setModel(ollamaModel, 50);
    const before = structuredClone(sampleState);
    const r = await applyEdit(sampleState, edit);
    expect(!r.ok && r.error.code).toBe(code);
    expect(r.state).toBe(sampleState);
    expect(sampleState).toEqual(before);
    expect(send).toHaveBeenCalledTimes(2); // both attempts failed
    expect(canUndo()).toBe(false);
  });

  it("maps a hanging model to TIMEOUT, latency covering both attempts", async () => {
    use("hang");
    const r = await applyEdit(sampleState, edit);
    expect(!r.ok && r.error.code).toBe("TIMEOUT");
    expect(r.latencyMs).toBeGreaterThanOrEqual(90);
  });

  it("times out a model that ignores its AbortSignal and never settles", async () => {
    setModel(() => new Promise<string>(() => {}), 20);
    const r = await applyEdit(sampleState, edit);
    expect(!r.ok && r.error.code).toBe("TIMEOUT");
    expect(r.state).toBe(sampleState);
  });

  it("sends the model the post-edit params and recomputed derived values", async () => {
    const m = use(answer);
    await applyEdit(sampleState, edit);
    const sent = m.calls[0]!.state;
    expect(sent.nodes.card_2.params.power).toBe(4);
    expect(sent.nodes.overview.derived.totalPower).toBe(15); // 18 before the edit
    expect(sent.nodes.card_2.content).toEqual(sampleState.nodes.card_2.content); // old text as the base
  });

  it("an unchanged value is a no-op without a model call", async () => {
    const m = use(answer);
    const r = await applyEdit(sampleState, { cardId: "card_2", param: "power", value: 7 });
    expect(r.ok && r.changed).toEqual([]);
    expect(r.state).toBe(sampleState);
    expect(m.calls).toHaveLength(0);
    expect(canUndo()).toBe(false);
  });

  it("does not mutate the input, even if the model client mutates its request", async () => {
    const before = structuredClone(sampleState);
    use((req) => {
      req.state.nodes.card_1.content.backstory = "vandalised";
      return answer(req);
    });
    const r = await applyEdit(sampleState, edit);
    expect(r.ok).toBe(true);
    expect(sampleState).toEqual(before);
  });

  it("sends the model the pre-edit state as `before` and the post-edit state as `state`", async () => {
    const m = use(answer);
    await applyEdit(sampleState, edit);
    const req = m.calls[0]!;
    expect(req.before).toEqual(sampleState);
    expect(req.before.nodes.card_2.params.power).toBe(7);
    expect(req.state.nodes.card_2.params.power).toBe(4);
    expect(req.state.nodes.overview.derived.totalPower).toBe(15);
    expect(req.state.nodes.card_2.content).toEqual(sampleState.nodes.card_2.content); // old content
  });

  it("a model client mutating `before` does not touch the caller's state", async () => {
    const snapshot = structuredClone(sampleState);
    use((req) => {
      req.before.nodes.card_2.params.power = 1;
      return answer(req);
    });
    expect((await applyEdit(sampleState, edit)).ok).toBe(true);
    expect(sampleState).toEqual(snapshot);
  });

  it("accepts a 60 s timeout for Ollama via setModel", async () => {
    setModel(async (req) => answer(req), 60_000);
    expect((await applyEdit(sampleState, edit)).ok).toBe(true);
  });
});

describe("regenerateAll (baseline)", () => {
  it("asks for all four nodes and reports off-scope changes", async () => {
    const m = use(answer);
    const r = await regenerateAll(sampleState, edit);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(m.calls[0]!.ids).toEqual(["card_1", "card_2", "card_3", "overview"]);
    expect(r.affected).toEqual(["card_2", "overview"]);
    expect(offScope(r)).toEqual(["card_1", "card_3"]);
  });

  it("a model that preserves the others gives no off-scope changes", async () => {
    use((req) => answer(req, ["card_2", "overview"]));
    const r = await regenerateAll(sampleState, edit);
    expect(r.ok && offScope(r)).toEqual([]);
  });

  it("still validates: a changed param fails with the original state", async () => {
    use(tweak((o) => (o.nodes.card_1.params.power = 9)));
    const r = await regenerateAll(sampleState, edit);
    expect(!r.ok && r.error.code).toBe("PARAM_MISMATCH");
    expect(r.state).toBe(sampleState);
    expect(canUndo()).toBe(false);
  });

  it("an unchanged value is a no-op here too", async () => {
    const m = use(answer);
    const r = await regenerateAll(sampleState, { cardId: "card_2", param: "power", value: 7 });
    expect(r.ok && r.changed).toEqual([]);
    expect(m.calls).toHaveLength(0);
  });
});

describe("undo", () => {
  it("restores the exact previous states across both conditions, newest first", async () => {
    use(answer);
    const r1 = await applyEdit(sampleState, edit);
    if (!r1.ok) throw new Error("r1 failed");
    await regenerateAll(r1.state, { cardId: "card_3", param: "gear", value: "fine" });
    expect(undo()).toBe(r1.state);
    expect(undo()).toEqual(sampleState);
    expect(undo()).toBeNull();
    expect(canUndo()).toBe(false);
  });

  it("resetHistory clears the stack", async () => {
    use(answer);
    await applyEdit(sampleState, edit);
    resetHistory();
    expect(canUndo()).toBe(false);
  });
});

describe("devModel (default until Role II)", () => {
  it("passes validation in both conditions", async () => {
    const { devModel } = await import("../src/backend/devModel");
    setModel(devModel, 2000);
    expect((await applyEdit(sampleState, edit)).ok).toBe(true);
    expect((await regenerateAll(sampleState, edit)).ok).toBe(true);
  });
});
