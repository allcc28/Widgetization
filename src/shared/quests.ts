// Hand-written quest library. Every requirement is checked in code (derived.ts), never by the
// model. Quests come in matched pairs of similar difficulty (two requirements each): a
// participant gets one pair, so each of their two conditions has a different but comparable
// task. The pair and the order follow from a seed, so a session is reproducible.

import type { Quest } from "./types";

/** No requirements: used for the dev sample and the tests. */
export const FREE_PLAY: Quest = {
  id: "free",
  title: "Free play",
  brief: "No quest. Tune the party however you like.",
  requirements: [],
};

const siege: Quest = {
  id: "siege",
  title: "Siege of Blackrock Keep",
  brief: "The keep's gates will not hold. You need two tanks (Paladin, Berserker) and enough armour to survive the first volley.",
  requirements: [
    { kind: "roleCount", role: "Tank", min: 2 },
    { kind: "minDefense", value: 24 },
  ],
};
const plague: Quest = {
  id: "plague",
  title: "The Plague Village",
  brief: "The villagers need healers and calm. Two supports (Cleric, Bard, Druid) are required, and no Berserker: they frighten the sick.",
  requirements: [
    { kind: "roleCount", role: "Support", min: 2 },
    { kind: "exclude", cls: "Berserker" },
  ],
};
const dragon: Quest = {
  id: "dragon",
  title: "The Dragon's Hoard",
  brief: "Strike fast before the dragon wakes: two damage heroes (Ranger, Mage, Rogue) and a heavy opening volley.",
  requirements: [
    { kind: "roleCount", role: "Damage", min: 2 },
    { kind: "minAttack", value: 26 },
  ],
};
const heist: Quest = {
  id: "heist",
  title: "The Moonlit Heist",
  brief: "A vault, a locked window and one night. You need a Rogue, and enough punch to cut through the guards.",
  requirements: [
    { kind: "include", cls: "Rogue" },
    { kind: "minAttack", value: 24 },
  ],
};
const wood: Quest = {
  id: "wood",
  title: "The Haunted Wood",
  brief: "The path is alive. Only a Druid can walk it, and the party must be sturdy enough to endure the shades.",
  requirements: [
    { kind: "include", cls: "Druid" },
    { kind: "minDefense", value: 22 },
  ],
};
const council: Quest = {
  id: "council",
  title: "The Council of Elders",
  brief: "Words win this fight. The council wants a Bard, and at least two supports (Cleric, Bard, Druid) to keep the peace.",
  requirements: [
    { kind: "include", cls: "Bard" },
    { kind: "roleCount", role: "Support", min: 2 },
  ],
};
const arena: Quest = {
  id: "arena",
  title: "The Ember Arena",
  brief: "A crowd wants blood. Hit hard, and keep clerics out: the arena forbids healing.",
  requirements: [
    { kind: "minAttack", value: 28 },
    { kind: "exclude", cls: "Cleric" },
  ],
};
const pass: Quest = {
  id: "pass",
  title: "The Frozen Pass",
  brief: "Nobody crosses alone. Bring a Paladin, and keep the party evenly matched so no one falls behind.",
  requirements: [
    { kind: "include", cls: "Paladin" },
    { kind: "maxGap", value: 2 },
  ],
};

export const QUEST_PAIRS: ReadonlyArray<readonly [Quest, Quest]> = [
  [siege, plague],
  [dragon, heist],
  [wood, council],
  [arena, pass],
];

export const QUESTS: ReadonlyArray<Quest> = QUEST_PAIRS.flat();

/** FNV-1a, so the same participant always gets the same pair and order. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The quest for one session. `taskId` "t2" is the second task, anything else the first.
 * The two tasks of a participant are the two quests of one matched pair, in a seeded order.
 */
export function questFor(participantId: string, taskId: string): Quest {
  const seed = hash(participantId);
  const pair = QUEST_PAIRS[seed % QUEST_PAIRS.length] as readonly [Quest, Quest];
  const flip = (seed >>> 8) & 1;
  const index = taskId === "t2" ? 1 : 0;
  return pair[index ^ flip] as Quest;
}
