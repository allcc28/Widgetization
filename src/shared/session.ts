// Study session helpers shared by the page and the researcher panel. Pure.

import type { Condition } from "./types";

export const TASK_IDS = ["t1", "t2"] as const;
export type TaskId = (typeof TASK_IDS)[number];

/** FNV-1a, only used to give ids without a number a stable parity. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Suggested condition order for a participant, to balance order across people: odd numbers
 * (P01, P03, ...) start with `bounded`, even numbers with `baseline`. Ids without digits fall
 * back to a stable hash parity. Session 1 is task t1, session 2 is task t2.
 */
export function conditionOrderFor(participantId: string): [Condition, Condition] {
  const digits = participantId.match(/\d+/g);
  const n = digits ? Number(digits[digits.length - 1]) : hash(participantId);
  return n % 2 === 1 ? ["bounded", "baseline"] : ["baseline", "bounded"];
}

/** The query string that launches one session (what `condition.ts` reads back). */
export function sessionSearch(s: { participant: string; condition: Condition; task: string }): string {
  const p = new URLSearchParams();
  p.set("condition", s.condition);
  p.set("participant", s.participant);
  p.set("task", s.task);
  return `?${p.toString()}`;
}
