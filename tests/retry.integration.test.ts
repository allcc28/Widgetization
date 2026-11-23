// Role III retry, end to end through the real applyEdit pipeline (retry, parse, check, commit, undo).
// The model is the existing scripted fake; parseOutput/checkOutput are the real functions, only spied on
// so each attempt's verdict can be asserted (the dev log is a no-op under Vitest).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEdit, canUndo, resetHistory, setModel, undo } from "../src/backend/api";
import * as validate from "../src/backend/validate";
import { sampleState } from "../src/shared/sampleState";
import type { Edit } from "../src/shared/types";
import { answer, scripted, tweak } from "./scriptedModel";

vi.mock("../src/backend/validate", async (load) => {
  const real = await load<typeof import("../src/backend/validate")>();
  return { ...real, parseOutput: vi.fn(real.parseOutput), checkOutput: vi.fn(real.checkOutput) };
});
const parse = vi.mocked(validate.parseOutput);
const check = vi.mocked(validate.checkOutput);

const edit: Edit = { cardId: "card_2", param: "power", value: 4 };
const verdict = (r: { type: string; value: unknown } | undefined) => (r?.value as validate.Check<unknown>);

function use(...steps: Parameters<typeof scripted>) {
  const m = scripted(...steps);
  setModel(m.fn, 50);
  return m;
}

beforeEach(() => {
  resetHistory();
  parse.mockClear();
  check.mockClear();
});

describe("Role III retry (bounded applyEdit)", () => {
  it("attempt 1 malformed JSON -> INVALID_JSON, attempt 2 valid -> one commit, undo restores", async () => {
    const before = structuredClone(sampleState);
    const m = use("{", answer);

    const r = await applyEdit(sampleState, edit);

    expect(m.calls).toHaveLength(2);
    expect(verdict(parse.mock.results[0])).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
    expect(verdict(check.mock.results[0])).toMatchObject({ ok: true }); // attempt 2 is the only one checked
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.nodes.card_2.params.power).toBe(4);
    expect(r.changed).toEqual(["card_2", "overview"]);
    expect(r.state.nodes.card_1).toEqual(sampleState.nodes.card_1);
    expect(r.state.nodes.card_3).toEqual(sampleState.nodes.card_3);

    expect(undo()).toBe(sampleState); // exactly one entry: the original state
    expect(canUndo()).toBe(false);
    expect(sampleState).toEqual(before);
  });

  it("attempt 1 off-scope node -> OFF_SCOPE_ID, attempt 2 valid -> one commit, undo restores", async () => {
    const m = use(tweak((o) => (o.nodes.card_1 = { content: sampleState.nodes.card_1.content })), answer);

    const r = await applyEdit(sampleState, edit);

    expect(m.calls).toHaveLength(2);
    expect(m.calls[0]!.ids).toEqual(["card_2", "overview"]);
    expect(verdict(check.mock.results[0])).toMatchObject({ ok: false, error: { code: "OFF_SCOPE_ID" } });
    expect(verdict(check.mock.results[1])).toMatchObject({ ok: true });
    expect(r.ok && r.changed).toEqual(["card_2", "overview"]);
    expect(undo()).toBe(sampleState);
    expect(canUndo()).toBe(false);
  });

  it("both attempts malformed -> INVALID_JSON, nothing committed, undo history unchanged", async () => {
    // One real commit first, so "unchanged history" means depth stays 1, not just "still empty".
    use(answer);
    const first = await applyEdit(sampleState, { cardId: "card_1", param: "power", value: 5 });
    if (!first.ok) throw new Error("setup commit failed");
    const committed = first.state;
    const snapshot = structuredClone(committed);
    parse.mockClear();

    const m = use("{");
    const r = await applyEdit(committed, edit);

    expect(m.calls).toHaveLength(2);
    expect(parse.mock.results.map(verdict)).toMatchObject([
      { ok: false, error: { code: "INVALID_JSON" } },
      { ok: false, error: { code: "INVALID_JSON" } },
    ]);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
    expect(r.state).toBe(committed); // the caller's state object comes back
    expect(committed).toEqual(snapshot); // and was not mutated

    expect(undo()).toBe(sampleState); // only the setup commit is on the stack
    expect(canUndo()).toBe(false);
  });
});
