import { describe, expect, it } from "vitest";
import { cardBreakdown, cardDerived, withDerived } from "../src/shared/derived";
import { CLASSES, GEARS, TEMPERAMENTS } from "../src/shared/types";
import { sampleState } from "../src/shared/sampleState";
import { checkRequirement } from "../src/shared/derived";
import type { Requirement, State } from "../src/shared/types";

describe("cardDerived", () => {
  it("combines power, role bonus, temperament and gear modifiers", () => {
    // Ranger = Damage (+2 attack), cautious = -1 attack / +2 defense, standard gear = 0
    expect(cardDerived({ cls: "Ranger", power: 6, temperament: "cautious", gear: "standard" })).toEqual({
      name: "Mira",
      role: "Damage",
      attack: 7,
      defense: 8,
    });
  });

  it("applies gear to both attack and defense", () => {
    const base = { cls: "Mage", power: 6, temperament: "cheerful" } as const;
    expect(cardDerived({ ...base, gear: "fine" })).toMatchObject({ attack: 10, defense: 8 });
    expect(cardDerived({ ...base, gear: "worn" })).toMatchObject({ attack: 6, defense: 4 });
  });

  it("never goes below 1", () => {
    // Berserker = Tank (+2 defense), reckless = -2 defense, so defense = 1 + 2 - 2 = 1
    expect(cardDerived({ cls: "Berserker", power: 1, temperament: "reckless", gear: "standard" }).defense).toBe(1);
  });
});

describe("cardBreakdown", () => {
  it("matches cardDerived for every class, temperament and power, so the explanation is always right", () => {
    for (const cls of CLASSES) {
      for (const temperament of TEMPERAMENTS) {
        for (const gear of GEARS) {
        for (let power = 1; power <= 10; power++) {
          const params = { cls, power, temperament, gear };
          const b = cardBreakdown(params);
          const d = cardDerived(params);
          expect(b.attack).toBe(d.attack);
          expect(b.defense).toBe(d.defense);
          // Unclamped terms add up to the shown total, except where the minimum of 1 applies.
          expect(Math.max(1, b.power + b.roleAtk + b.tempAtk + b.gearAtk)).toBe(b.attack);
          expect(Math.max(1, b.power + b.roleDef + b.tempDef + b.gearDef)).toBe(b.defense);
        }
        }
      }
    }
  });
});

describe("withDerived (sample party)", () => {
  it("computes the evaluation of the sample party", () => {
    const o = sampleState.nodes.overview.derived;
    expect(o).toEqual({
      totalPower: 18,
      totalAttack: 21,
      totalDefense: 21,
      rating: "A",
      findings: ["Balanced party."],
      requirements: [],
    });
  });

  it("does not mutate its input", () => {
    const before = structuredClone(sampleState);
    withDerived(sampleState);
    expect(sampleState).toEqual(before);
  });

  it("flags a weak tank and lowers the rating when the tank is weakened", () => {
    const s: State = structuredClone(sampleState);
    s.nodes.card_2.params.power = 3;
    const o = withDerived(s).nodes.overview.derived;
    expect(o.findings).toEqual(["Brann can't hold the front line (defense 3)."]);
    expect(o.rating).toBe("B");
  });

  it("flags a missing role and lowers the rating", () => {
    const s: State = structuredClone(sampleState);
    s.nodes.card_3.params.cls = "Mage"; // no Support left
    const o = withDerived(s).nodes.overview.derived;
    expect(o.findings).toEqual(["No support in the party."]);
    expect(o.rating).toBe("B");
  });

  it("lets gear move the rating", () => {
    const s: State = structuredClone(sampleState);
    for (const id of ["card_1", "card_2", "card_3"] as const) s.nodes[id].params.gear = "worn";
    expect(withDerived(s).nodes.overview.derived.rating).toBe("B");
    for (const id of ["card_1", "card_2", "card_3"] as const) s.nodes[id].params.gear = "fine";
    expect(withDerived(s).nodes.overview.derived.rating).toBe("S");
  });

  it("flags a large power gap", () => {
    const s: State = structuredClone(sampleState);
    s.nodes.card_1.params.power = 10;
    s.nodes.card_3.params.power = 2;
    const o = withDerived(s).nodes.overview.derived;
    expect(o.findings).toContain("Power gap: Mira (10) vs Sela (2).");
  });
});

describe("quests", () => {
  it("gives every hero exactly one name", () => {
    const names = CLASSES.map((c) => cardDerived({ cls: c, power: 5, temperament: "loyal", gear: "standard" }).name);
    expect(new Set(names).size).toBe(CLASSES.length);
  });

  it("checks each requirement kind against the party", () => {
    const s: State = structuredClone(sampleState); // Ranger, Berserker, Cleric: attack 21, defense 21
    const req = (r: Requirement) => checkRequirement(r, [s.nodes.card_1, s.nodes.card_2, s.nodes.card_3]);
    expect(req({ kind: "roleCount", role: "Tank", min: 1 })).toBe(true);
    expect(req({ kind: "roleCount", role: "Tank", min: 2 })).toBe(false);
    expect(req({ kind: "minAttack", value: 21 })).toBe(true);
    expect(req({ kind: "minAttack", value: 22 })).toBe(false);
    expect(req({ kind: "minDefense", value: 21 })).toBe(true);
    expect(req({ kind: "minDefense", value: 22 })).toBe(false);
    expect(req({ kind: "include", cls: "Cleric" })).toBe(true);
    expect(req({ kind: "include", cls: "Druid" })).toBe(false);
    expect(req({ kind: "exclude", cls: "Rogue" })).toBe(true);
    expect(req({ kind: "exclude", cls: "Cleric" })).toBe(false);
    expect(req({ kind: "maxGap", value: 2 })).toBe(true); // powers 6, 7, 5
    expect(req({ kind: "maxGap", value: 1 })).toBe(false);
  });

  it("lowers the rating by one grade for each unmet requirement", () => {
    const s: State = structuredClone(sampleState);
    expect(withDerived(s).nodes.overview.derived.rating).toBe("A");
    s.quest = {
      id: "t",
      title: "t",
      brief: "t",
      requirements: [
        { kind: "include", cls: "Druid" },
        { kind: "minAttack", value: 99 },
      ],
    };
    const o = withDerived(s).nodes.overview.derived;
    expect(o.requirements.map((r) => r.met)).toEqual([false, false]);
    expect(o.rating).toBe("C");
  });
});
