// The eight heroes: one per class. Name, portrait and role all follow from the class,
// so choosing a class for a slot chooses the hero. A hero can appear once per party.

import type { CharacterClass } from "./types";

export const HERO_NAME: Record<CharacterClass, string> = {
  Ranger: "Mira",
  Berserker: "Brann",
  Cleric: "Sela",
  Mage: "Orin",
  Rogue: "Vex",
  Paladin: "Aldric",
  Bard: "Tobin",
  Druid: "Rowan",
};
