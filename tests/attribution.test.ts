import { describe, expect, it } from "vitest";
import { attributionFor, describeEdit } from "../src/client/attribution";
import { applyParam } from "../src/shared/applyParam";
import { withDerived } from "../src/shared/derived";
import { sampleState } from "../src/shared/sampleState";
import type { Edit } from "../src/shared/types";

const before = withDerived(sampleState);
const after = (edit: Edit) => withDerived(applyParam(before, edit));

describe("describeEdit", () => {
  it("names the hero, the parameter and both values", () => {
    const edit: Edit = { cardId: "card_2", param: "power", value: 3 };
    expect(describeEdit(before, after(edit), edit)).toBe("you changed Brann’s power from 7 to 3");
  });

  it("describes a hero change as a swap", () => {
    const edit: Edit = { cardId: "card_1", param: "cls", value: "Paladin" };
    expect(describeEdit(before, after(edit), edit)).toBe("you swapped Mira for Aldric");
  });
});

describe("attributionFor", () => {
  const edit: Edit = { cardId: "card_2", param: "power", value: 3 };
  const next = after(edit);

  it("explains the edited card by the edit", () => {
    expect(attributionFor(before, next, edit, ["card_2", "overview"], "card_2")).toBe(
      "Updated because you changed Brann’s power from 7 to 3.",
    );
  });

  it("explains the overview by what it reads", () => {
    expect(attributionFor(before, next, edit, ["card_2", "overview"], "overview")).toBe(
      "Updated because it reads Brann: you changed Brann’s power from 7 to 3.",
    );
  });

  it("gives nothing for a node that did not change", () => {
    expect(attributionFor(before, next, edit, ["card_2", "overview"], "card_1")).toBeNull();
  });

  it("labels a changed node outside the closure as a whole-party rewrite", () => {
    expect(attributionFor(before, next, edit, ["card_1", "card_2", "overview"], "card_1")).toMatch(
      /whole-party update/,
    );
  });
});
