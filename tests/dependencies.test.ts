import { describe, expect, it } from "vitest";
import { affectedSet, explainAffected } from "../src/shared/dependencies";

describe("affectedSet", () => {
  it("power on card_2 affects card_2 and overview only", () => {
    expect(affectedSet({ cardId: "card_2", param: "power", value: 4 })).toEqual([
      "card_2",
      "overview",
    ]);
  });

  it("gear on card_3 affects card_3 and overview only", () => {
    expect(affectedSet({ cardId: "card_3", param: "gear", value: "fine" })).toEqual([
      "card_3",
      "overview",
    ]);
  });

  it("temperament on card_1 affects card_1 and overview only", () => {
    expect(affectedSet({ cardId: "card_1", param: "temperament", value: "loyal" })).toEqual([
      "card_1",
      "overview",
    ]);
  });

  it("never includes other cards", () => {
    const set = affectedSet({ cardId: "card_3", param: "power", value: 9 });
    expect(set).not.toContain("card_1");
    expect(set).not.toContain("card_2");
  });
});

describe("explainAffected", () => {
  it("gives the same IDs as affectedSet, each with a reason", () => {
    const edit = { cardId: "card_2", param: "gear", value: "fine" } as const;
    expect(explainAffected(edit).map((e) => e.id)).toEqual(affectedSet(edit));
  });

  it("says the edited card is edited and the overview reads it", () => {
    expect(explainAffected({ cardId: "card_2", param: "power", value: 4 })).toEqual([
      { id: "card_2", why: { kind: "edited" } },
      { id: "overview", why: { kind: "reads", from: "card_2" } },
    ]);
  });
});
