import { describe, expect, it } from "vitest";
import { applyParam } from "../src/shared/applyParam";
import { affectedSet } from "../src/shared/dependencies";
import { withDerived } from "../src/shared/derived";
import { sampleState } from "../src/shared/sampleState";
import type { Edit } from "../src/shared/types";
import { checkOutput, parseOutput } from "../src/backend/validate";
import { answer, tweak } from "./scriptedModel";

const edit: Edit = { cardId: "card_2", param: "power", value: 4 };
const expected = withDerived(applyParam(sampleState, edit));
const ids = affectedSet(edit); // card_2, overview
const req = { mode: "bounded" as const, state: expected, edit, ids };

function validate(raw: string) {
  const p = parseOutput(raw);
  return p.ok ? checkOutput(p.value, { expected, ids }) : p;
}
const codeOf = (raw: string) => {
  const r = validate(raw);
  return r.ok ? "ok" : r.error.code;
};
const bad = (f: (o: any) => void) => codeOf(tweak(f)(req));

describe("validate", () => {
  it("accepts a good answer and returns only content", () => {
    const r = validate(answer(req));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.value)).toEqual(["card_2", "overview"]);
    expect(r.value.card_2).toEqual({ ...expected.nodes.card_2.content, backstory: `${expected.nodes.card_2.content.backstory} (new)` });
  });

  it("INVALID_JSON on malformed output", () => expect(codeOf("{nodes: oops")).toBe("INVALID_JSON"));
  it("SCHEMA_MISMATCH without nodes", () => expect(codeOf('{"cards": {}}')).toBe("SCHEMA_MISMATCH"));
  it("SCHEMA_MISMATCH on missing content", () => expect(bad((o) => delete o.nodes.card_2.content)).toBe("SCHEMA_MISMATCH"));
  it("SCHEMA_MISMATCH on a wrong type", () => expect(bad((o) => (o.nodes.card_2.content.abilities = "Axe"))).toBe("SCHEMA_MISMATCH"));
  it("OFF_SCOPE_ID on an extra fixed id", () =>
    expect(bad((o) => (o.nodes.card_1 = { content: sampleState.nodes.card_1.content }))).toBe("OFF_SCOPE_ID"));
  it("OFF_SCOPE_ID on an invented id", () => expect(bad((o) => (o.nodes.card_9 = { content: {} }))).toBe("OFF_SCOPE_ID"));
  it("SCHEMA_MISMATCH when an affected id is missing", () => expect(bad((o) => delete o.nodes.overview)).toBe("SCHEMA_MISMATCH"));
  it("OUT_OF_RANGE on power 12", () => expect(bad((o) => (o.nodes.card_2.params.power = 12))).toBe("OUT_OF_RANGE"));
  it("OUT_OF_RANGE on an unknown gear", () => expect(bad((o) => (o.nodes.card_2.params.gear = "legendary"))).toBe("OUT_OF_RANGE"));
  it("PARAM_MISMATCH on a changed param", () => expect(bad((o) => (o.nodes.card_2.params.power = 5))).toBe("PARAM_MISMATCH"));
  it("PARAM_MISMATCH on a changed quest", () => expect(bad((o) => (o.quest.title = "Other quest"))).toBe("PARAM_MISMATCH"));
  it("accepts answers without params or quest", () =>
    expect(bad((o) => { delete o.quest; delete o.nodes.card_2.params; })).toBe("ok"));

  it("never reads derived or extra fields from the model", () => {
    const r = validate(tweak((o) => {
      o.nodes.card_2.derived = { name: "Evil", attack: 99 };
      o.nodes.card_2.content.mood = "grim";
    })(req));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.card_2).not.toHaveProperty("mood");
  });
});
