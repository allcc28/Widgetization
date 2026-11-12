import { describe, expect, it } from "vitest";
import { diffTokens, diffWords } from "../src/shared/textDiff";

const rebuild = (parts: { kind: string; value: string }[], keep: "same" | "add" | "del") =>
  parts.filter((p) => p.kind === "same" || p.kind === keep).map((p) => p.value).join("");

describe("diffWords", () => {
  it("returns one unchanged part for identical text", () => {
    expect(diffWords("a b c", "a b c")).toEqual([{ kind: "same", value: "a b c" }]);
  });

  it("marks replaced words as deleted and added", () => {
    const parts = diffWords("a strong mage", "a weak mage");
    expect(parts.filter((p) => p.kind === "del").map((p) => p.value)).toEqual(["strong"]);
    expect(parts.filter((p) => p.kind === "add").map((p) => p.value)).toEqual(["weak"]);
  });

  it("can rebuild both the old and the new text", () => {
    const before = "Brann left his clan after a duel.";
    const after = "Brann left his clan after a duel he should not have accepted (revised).";
    const parts = diffWords(before, after);
    expect(rebuild(parts, "del")).toBe(before);
    expect(rebuild(parts, "add")).toBe(after);
  });
});

describe("diffWords on a rewrite", () => {
  it("shows a whole replacement when the texts share hardly any words", () => {
    const before = "Raised on the northern marches, Mira trusts maps more than people.";
    const after = "Orin studies the old star charts and speaks little of what they show.";
    expect(diffWords(before, after)).toEqual([
      { kind: "del", value: before },
      { kind: "add", value: after },
    ]);
  });

  it("keeps a word diff for a small edit", () => {
    const parts = diffWords("Brann left his clan after a duel.", "Brann left his clan after a duel. (revised)");
    expect(parts.some((p) => p.kind === "same")).toBe(true);
    expect(parts.filter((p) => p.kind === "add").map((p) => p.value.trim())).toEqual(["(revised)"]);
  });
});

describe("diffTokens", () => {
  it("works on lists, for the ability chips", () => {
    const parts = diffTokens(["Mend wounds", "Ward"], ["Mend wounds", "Shield wall"]);
    expect(parts).toEqual([
      { kind: "same", value: "Mend wounds" },
      { kind: "del", value: "Ward" },
      { kind: "add", value: "Shield wall" },
    ]);
  });
});
