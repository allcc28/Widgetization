import { describe, expect, it } from "vitest";
import { applyParam, isClassTaken, isEditAllowed } from "../src/shared/applyParam";
import { withDerived } from "../src/shared/derived";
import { QUEST_PAIRS, QUESTS, questFor } from "../src/shared/quests";
import { sampleState } from "../src/shared/sampleState";
import type { CardNode, CharacterClass, Gear, State, Temperament } from "../src/shared/types";

type Hero = [CharacterClass, number, Temperament, Gear];
const party = (quest: State["quest"], heroes: [Hero, Hero, Hero]): State => {
  const s: State = structuredClone(sampleState);
  s.quest = quest;
  (["card_1", "card_2", "card_3"] as const).forEach((id, i) => {
    const [cls, power, temperament, gear] = heroes[i] as Hero;
    s.nodes[id].params = { cls, power, temperament, gear } as CardNode["params"];
  });
  return withDerived(s);
};

// One hand-built solution per quest, so every quest is known to be solvable.
const SOLUTIONS: Record<string, [Hero, Hero, Hero]> = {
  siege: [["Paladin", 7, "cautious", "fine"], ["Berserker", 7, "loyal", "fine"], ["Cleric", 5, "loyal", "standard"]],
  plague: [["Cleric", 6, "loyal", "standard"], ["Druid", 6, "loyal", "standard"], ["Paladin", 6, "cautious", "fine"]],
  dragon: [["Ranger", 8, "reckless", "fine"], ["Mage", 8, "reckless", "fine"], ["Cleric", 5, "cheerful", "standard"]],
  heist: [["Rogue", 8, "reckless", "fine"], ["Ranger", 6, "cunning", "standard"], ["Cleric", 5, "cheerful", "standard"]],
  wood: [["Druid", 6, "loyal", "fine"], ["Paladin", 6, "cautious", "standard"], ["Cleric", 5, "loyal", "standard"]],
  council: [["Bard", 5, "cheerful", "standard"], ["Cleric", 5, "cheerful", "standard"], ["Ranger", 5, "cheerful", "standard"]],
  arena: [["Ranger", 8, "reckless", "fine"], ["Mage", 8, "reckless", "fine"], ["Rogue", 4, "cheerful", "standard"]],
  pass: [["Paladin", 6, "loyal", "standard"], ["Ranger", 6, "loyal", "standard"], ["Bard", 5, "loyal", "standard"]],
};

describe("quest library", () => {
  it("has four matched pairs of two requirements each, with unique ids", () => {
    expect(QUEST_PAIRS).toHaveLength(4);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) expect(q.requirements).toHaveLength(2);
  });

  it("does not start solved: the sample party fails every quest", () => {
    for (const q of QUESTS) {
      const s = withDerived({ ...sampleState, quest: q });
      expect(s.nodes.overview.derived.requirements.some((r) => !r.met), q.id).toBe(true);
    }
  });

  it("is solvable: each quest is met by its hand-built party", () => {
    for (const q of QUESTS) {
      const s = party(q, SOLUTIONS[q.id] as [Hero, Hero, Hero]);
      const unmet = s.nodes.overview.derived.requirements.filter((r) => !r.met);
      expect(unmet, q.id).toEqual([]);
    }
  });
});

describe("questFor", () => {
  it("is deterministic for a participant and task", () => {
    expect(questFor("P01", "t1")).toBe(questFor("P01", "t1"));
  });

  it("gives a participant the two quests of one matched pair", () => {
    for (const id of ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10"]) {
      const a = questFor(id, "t1");
      const b = questFor(id, "t2");
      expect(a.id).not.toBe(b.id);
      const pair = QUEST_PAIRS.find((p) => p.some((q) => q.id === a.id));
      expect(pair?.some((q) => q.id === b.id)).toBe(true);
    }
  });

  it("covers more than one pair across participants", () => {
    const first = new Set(["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"].map((p) => questFor(p, "t1").id));
    expect(first.size).toBeGreaterThan(2);
  });
});

describe("hero uniqueness", () => {
  it("rejects a class used by another card and allows a free one", () => {
    expect(isClassTaken(sampleState, "card_1", "Cleric")).toBe(true);
    expect(isClassTaken(sampleState, "card_1", "Ranger")).toBe(false); // its own class
    expect(isEditAllowed(sampleState, { cardId: "card_1", param: "cls", value: "Cleric" })).toBe(false);
    expect(isEditAllowed(sampleState, { cardId: "card_1", param: "cls", value: "Mage" })).toBe(true);
  });

  it("validates ranges and fixed lists", () => {
    expect(isEditAllowed(sampleState, { cardId: "card_1", param: "power", value: 11 })).toBe(false);
    expect(isEditAllowed(sampleState, { cardId: "card_1", param: "power", value: 4.5 })).toBe(false);
    expect(isEditAllowed(sampleState, { cardId: "card_1", param: "gear", value: "fine" })).toBe(true);
  });

  it("applyParam sets the class and keeps the quest", () => {
    const next = applyParam(sampleState, { cardId: "card_2", param: "cls", value: "Paladin" });
    expect(next.nodes.card_2.params.cls).toBe("Paladin");
    expect(next.quest).toBe(sampleState.quest);
  });
});
