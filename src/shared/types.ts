// Shared types. Mirrors contracts.md; change both together.

export const CARD_IDS = ["card_1", "card_2", "card_3"] as const;
export const NODE_IDS = [...CARD_IDS, "overview"] as const;

export type CardId = (typeof CARD_IDS)[number];
export type NodeId = (typeof NODE_IDS)[number];

export const TEMPERAMENTS = [
  "cautious",
  "reckless",
  "loyal",
  "cunning",
  "cheerful",
  "brooding",
] as const;
export type Temperament = (typeof TEMPERAMENTS)[number];

export const GEARS = ["worn", "standard", "fine"] as const;
export type Gear = (typeof GEARS)[number];

export const POWER_MIN = 1;
export const POWER_MAX = 10;

export const CLASSES = [
  "Ranger",
  "Berserker",
  "Cleric",
  "Mage",
  "Rogue",
  "Paladin",
  "Bard",
  "Druid",
] as const;
export type CharacterClass = (typeof CLASSES)[number];

export const ROLES = ["Tank", "Damage", "Support"] as const;
export type Role = (typeof ROLES)[number];

// Best to worst.
export const RATINGS = ["S", "A", "B", "C", "D"] as const;
export type Rating = (typeof RATINGS)[number];

export interface CardNode {
  /** Written only by the UI. `cls` picks a hero: the name, portrait and role follow from it. */
  params: { cls: CharacterClass; power: number; temperament: Temperament; gear: Gear };
  /** Computed in code by `withDerived`; never written by the model. `name` is the hero's name. */
  derived: { name: string; role: Role; attack: number; defense: number };
  content: { backstory: string; abilities: string[] };
}

export interface OverviewNode {
  /** The party evaluation. Computed in code by `withDerived`; never written by the model. */
  derived: {
    totalPower: number;
    totalAttack: number;
    totalDefense: number;
    rating: Rating;
    findings: string[];
    /** The quest's requirements, each checked in code against the current party. */
    requirements: { text: string; met: boolean }[];
  };
  content: { summary: string };
}

/** One checkable condition of a quest. Evaluated in code, never by the model. */
export type Requirement =
  | { kind: "roleCount"; role: Role; min: number }
  | { kind: "minAttack"; value: number }
  | { kind: "minDefense"; value: number }
  | { kind: "include"; cls: CharacterClass }
  | { kind: "exclude"; cls: CharacterClass }
  | { kind: "maxGap"; value: number };

/** The task background. Part of the state but read-only: no edit or model output may change it. */
export interface Quest {
  id: string;
  title: string;
  brief: string;
  requirements: Requirement[];
}

export interface State {
  quest: Quest;
  nodes: {
    card_1: CardNode;
    card_2: CardNode;
    card_3: CardNode;
    overview: OverviewNode;
  };
}

export type Edit =
  | { cardId: CardId; param: "cls"; value: CharacterClass }
  | { cardId: CardId; param: "power"; value: number }
  | { cardId: CardId; param: "temperament"; value: Temperament }
  | { cardId: CardId; param: "gear"; value: Gear };

export type ErrorCode =
  | "MODEL_ERROR"
  | "TIMEOUT"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "OFF_SCOPE_ID"
  | "PARAM_MISMATCH"
  | "OUT_OF_RANGE"
  | "INVALID_EDIT";

export interface UpdateError {
  code: ErrorCode;
  message: string;
}

export type UpdateResult =
  | { ok: true; state: State; affected: NodeId[]; changed: NodeId[]; latencyMs: number }
  | { ok: false; state: State; error: UpdateError; latencyMs: number };

export type Condition = "bounded" | "baseline";

// Log events (contracts.md section 3). `logEvent` stamps the session fields and a timestamp.
export interface LogSession {
  participantId: string;
  condition: Condition;
  taskId: string;
}

export type LogEventBody =
  | { type: "task_start" }
  | { type: "task_end" }
  | { type: "card_enter"; cardId: NodeId }
  | { type: "card_leave"; cardId: NodeId }
  | {
      type: "param_preview";
      cardId: CardId;
      param: Edit["param"];
      from: number | string;
      to: number | string;
      previewedAffected: NodeId[];
    }
  | { type: "apply_click"; edit: Edit }
  | {
      type: "apply_result";
      ok: boolean;
      latencyMs: number;
      affected: NodeId[];
      changed: NodeId[];
      offScope: NodeId[];
      errorCode?: ErrorCode;
    }
  | { type: "undo_click" };

export type LogEvent = LogSession & { timestamp: number } & LogEventBody;
