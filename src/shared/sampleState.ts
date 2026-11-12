import { withDerived } from "./derived";
import { FREE_PLAY } from "./quests";
import type { CardNode, State } from "./types";

// Placeholder party for UI development. The study will use a fixed pre-generated one.
// `derived` values below are placeholders; withDerived computes the real ones.
const noStats: CardNode["derived"] = { name: "", role: "Damage", attack: 0, defense: 0 };

export const sampleState: State = withDerived({
  quest: FREE_PLAY,
  nodes: {
    card_1: {
      params: { cls: "Ranger", power: 6, temperament: "cautious", gear: "standard" },
      derived: noStats,
      content: {
        backstory: "Raised on the northern marches, Mira trusts maps more than people.",
        abilities: ["Longbow volley", "Track prey"],
      },
    },
    card_2: {
      params: { cls: "Berserker", power: 7, temperament: "reckless", gear: "standard" },
      derived: noStats,
      content: {
        backstory: "Brann left his clan after a duel he should not have accepted.",
        abilities: ["Whirling axe", "Battle cry"],
      },
    },
    card_3: {
      params: { cls: "Cleric", power: 5, temperament: "loyal", gear: "standard" },
      derived: noStats,
      content: {
        backstory: "Sela follows the party because she swore an oath to protect Mira.",
        abilities: ["Mend wounds", "Ward"],
      },
    },
    overview: {
      derived: { totalPower: 0, totalAttack: 0, totalDefense: 0, rating: "D", findings: [], requirements: [] },
      content: { summary: "A hard-hitting but fragile party held together by Sela's oath." },
    },
  },
});
