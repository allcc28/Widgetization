import { beforeEach, describe, expect, it } from "vitest";
import { applyEdit, canUndo, regenerateAll, resetHistory, undo } from "../src/backend/fakeApi";
import { sampleState } from "../src/shared/sampleState";

beforeEach(() => resetHistory());

describe("fake applyEdit (bounded)", () => {
  it("leaves card_1 and card_3 identical when card_2 power changes", async () => {
    const r = await applyEdit(sampleState, { cardId: "card_2", param: "power", value: 4 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.nodes.card_1).toEqual(sampleState.nodes.card_1);
    expect(r.state.nodes.card_3).toEqual(sampleState.nodes.card_3);
    expect(r.changed).toEqual(["card_2", "overview"]);
    expect(r.state.nodes.overview.derived.totalPower).toBe(15);
  });

  it("does not mutate the input state", async () => {
    const before = structuredClone(sampleState);
    await applyEdit(sampleState, { cardId: "card_2", param: "power", value: 4 });
    expect(sampleState).toEqual(before);
  });

  it("never changes the quest", async () => {
    const r = await applyEdit(sampleState, { cardId: "card_2", param: "power", value: 4 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.quest).toEqual(sampleState.quest);
  });

  it("swaps the hero on a class edit and leaves the other cards alone", async () => {
    const r = await applyEdit(sampleState, { cardId: "card_1", param: "cls", value: "Mage" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.nodes.card_1.derived.name).toBe("Orin");
    expect(r.state.nodes.card_1.derived.role).toBe("Damage");
    expect(r.state.nodes.card_2).toEqual(sampleState.nodes.card_2);
    expect(r.state.nodes.card_3).toEqual(sampleState.nodes.card_3);
    expect(r.changed).toEqual(["card_1", "overview"]);
  });

  it("rejects a hero that is already in the party, without changing anything", async () => {
    const r = await applyEdit(sampleState, { cardId: "card_1", param: "cls", value: "Cleric" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INVALID_EDIT");
    expect(r.state).toEqual(sampleState);
    expect(canUndo()).toBe(false);
  });

  it("undo restores the exact previous state", async () => {
    await applyEdit(sampleState, { cardId: "card_2", param: "power", value: 4 });
    expect(canUndo()).toBe(true);
    expect(undo()).toEqual(sampleState);
    expect(canUndo()).toBe(false);
  });
});

describe("fake regenerateAll (baseline)", () => {
  it("reports off-scope changes (changed minus affected)", async () => {
    const r = await regenerateAll(sampleState, { cardId: "card_2", param: "power", value: 4 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const offScope = r.changed.filter((id) => !r.affected.includes(id));
    expect(offScope).toEqual(["card_1", "card_3"]);
  });
});
