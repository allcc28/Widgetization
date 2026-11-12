// Everything here is computed in code, never by the model. Pure: returns new objects.
// The tables and constants are exported so the in-page "How is this scored?" panel reads
// the same numbers, and the explanation can never drift from the calculation.
//
// Card stats:   attack  = power + role bonus + temperament modifier + gear modifier   (min 1)
//               defense = power + role bonus + temperament modifier + gear modifier   (min 1)
// Party rating: from the average strength, where a card's strength is (attack + defense) / 2
//               (see RATING_THRESHOLDS), one grade worse for each missing role, one for a
//               power gap above POWER_GAP_LIMIT, and one for each unmet quest requirement.
// Hero:         the name follows from the class (see heroes.ts).

import { HERO_NAME } from "./heroes";
import {
  RATINGS,
  ROLES,
  type CardNode,
  type CharacterClass,
  type Gear,
  type OverviewNode,
  type Quest,
  type Requirement,
  type Rating,
  type Role,
  type State,
  type Temperament,
} from "./types";

export const ROLE_OF_CLASS: Record<CharacterClass, Role> = {
  Paladin: "Tank",
  Berserker: "Tank",
  Ranger: "Damage",
  Mage: "Damage",
  Rogue: "Damage",
  Cleric: "Support",
  Bard: "Support",
  Druid: "Support",
};

export const ROLE_MODS: Record<Role, { atk: number; def: number }> = {
  Tank: { atk: 0, def: 2 },
  Damage: { atk: 2, def: 0 },
  Support: { atk: 0, def: 0 },
};

export const TEMPERAMENT_MODS: Record<Temperament, { atk: number; def: number }> = {
  cautious: { atk: -1, def: 2 },
  reckless: { atk: 2, def: -2 },
  loyal: { atk: 0, def: 1 },
  cunning: { atk: 1, def: 0 },
  cheerful: { atk: 0, def: 0 },
  brooding: { atk: 1, def: -1 },
};

export const GEAR_MODS: Record<Gear, { atk: number; def: number }> = {
  worn: { atk: -2, def: -2 },
  standard: { atk: 0, def: 0 },
  fine: { atk: 2, def: 2 },
};

/** Average strength needed for each rating, best first. Below the last one is "D". */
export const RATING_THRESHOLDS: ReadonlyArray<{ min: number; rating: Rating }> = [
  { min: 8, rating: "S" },
  { min: 6.5, rating: "A" },
  { min: 5, rating: "B" },
  { min: 3.5, rating: "C" },
];

/** A gap between the strongest and weakest power above this costs one grade. */
export const POWER_GAP_LIMIT = 4;

/** A best tank with defense below this gets a finding (no grade penalty). */
export const WEAK_TANK_DEFENSE = 6;

/** How a card's attack and defense are built up, term by term. */
export function cardBreakdown(params: CardNode["params"]) {
  const role = ROLE_OF_CLASS[params.cls];
  const r = ROLE_MODS[role];
  const t = TEMPERAMENT_MODS[params.temperament];
  const g = GEAR_MODS[params.gear];
  return {
    role,
    power: params.power,
    roleAtk: r.atk,
    roleDef: r.def,
    tempAtk: t.atk,
    tempDef: t.def,
    gearAtk: g.atk,
    gearDef: g.def,
    attack: Math.max(1, params.power + r.atk + t.atk + g.atk),
    defense: Math.max(1, params.power + r.def + t.def + g.def),
  };
}

export function cardDerived(params: CardNode["params"]): CardNode["derived"] {
  const b = cardBreakdown(params);
  return { name: HERO_NAME[params.cls], role: b.role, attack: b.attack, defense: b.defense };
}

/** One quest requirement as a short sentence. */
export function describeRequirement(r: Requirement): string {
  switch (r.kind) {
    case "roleCount":
      return `At least ${r.min} ${r.role.toLowerCase()}${r.min > 1 ? "s" : ""}`;
    case "minAttack":
      return `Total attack at least ${r.value}`;
    case "minDefense":
      return `Total defense at least ${r.value}`;
    case "include":
      return `Includes a ${r.cls}`;
    case "exclude":
      return `No ${r.cls}`;
    case "maxGap":
      return `Power gap at most ${r.value}`;
  }
}

/** Whether the party meets one requirement. Expects cards whose own `derived` is up to date. */
export function checkRequirement(r: Requirement, cards: CardNode[]): boolean {
  const powers = cards.map((c) => c.params.power);
  switch (r.kind) {
    case "roleCount":
      return cards.filter((c) => c.derived.role === r.role).length >= r.min;
    case "minAttack":
      return cards.reduce((s, c) => s + c.derived.attack, 0) >= r.value;
    case "minDefense":
      return cards.reduce((s, c) => s + c.derived.defense, 0) >= r.value;
    case "include":
      return cards.some((c) => c.params.cls === r.cls);
    case "exclude":
      return !cards.some((c) => c.params.cls === r.cls);
    case "maxGap":
      return Math.max(...powers) - Math.min(...powers) <= r.value;
  }
}

function ratingFor(averageStrength: number, penalties: number): Rating {
  const found = RATING_THRESHOLDS.findIndex((t) => averageStrength >= t.min);
  const base = found === -1 ? RATINGS.length - 1 : found;
  return RATINGS[Math.min(RATINGS.length - 1, base + penalties)] as Rating;
}

/** The party evaluation. Expects cards whose own `derived` is already up to date. */
export function partyDerived(cards: CardNode[], quest: Quest): OverviewNode["derived"] {
  const sum = (f: (c: CardNode) => number) => cards.reduce((s, c) => s + f(c), 0);
  const totalPower = sum((c) => c.params.power);
  const totalAttack = sum((c) => c.derived.attack);
  const totalDefense = sum((c) => c.derived.defense);

  const findings: string[] = [];
  let penalties = 0;

  for (const role of ROLES) {
    if (!cards.some((c) => c.derived.role === role)) {
      findings.push(`No ${role.toLowerCase()} in the party.`);
      penalties++;
    }
  }

  const strongest = cards.reduce((a, c) => (c.params.power > a.params.power ? c : a));
  const weakest = cards.reduce((a, c) => (c.params.power < a.params.power ? c : a));
  if (strongest.params.power - weakest.params.power > POWER_GAP_LIMIT) {
    findings.push(
      `Power gap: ${strongest.derived.name} (${strongest.params.power}) vs ${weakest.derived.name} (${weakest.params.power}).`,
    );
    penalties++;
  }

  const tanks = cards.filter((c) => c.derived.role === "Tank");
  if (tanks.length > 0) {
    const best = tanks.reduce((a, c) => (c.derived.defense > a.derived.defense ? c : a));
    if (best.derived.defense < WEAK_TANK_DEFENSE) {
      findings.push(`${best.derived.name} can't hold the front line (defense ${best.derived.defense}).`);
    }
  }

  const requirements = quest.requirements.map((r) => ({
    text: describeRequirement(r),
    met: checkRequirement(r, cards),
  }));
  const unmet = requirements.filter((r) => !r.met).length;
  if (unmet > 0) findings.push(`${unmet} quest requirement${unmet > 1 ? "s" : ""} not met.`);
  penalties += unmet;

  if (findings.length === 0) findings.push("Balanced party.");

  return {
    totalPower,
    totalAttack,
    totalDefense,
    rating: ratingFor((totalAttack + totalDefense) / (2 * cards.length), penalties),
    findings,
    requirements,
  };
}

/** Recompute all derived values from params and the quest. Returns a new state; never mutates. */
export function withDerived(state: State): State {
  const withCard = (n: CardNode): CardNode => ({
    ...n,
    derived: cardDerived(n.params),
  });
  const card_1 = withCard(state.nodes.card_1);
  const card_2 = withCard(state.nodes.card_2);
  const card_3 = withCard(state.nodes.card_3);
  const overview = {
    ...state.nodes.overview,
    derived: partyDerived([card_1, card_2, card_3], state.quest),
  };
  return { ...state, nodes: { card_1, card_2, card_3, overview } };
}
