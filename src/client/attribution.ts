// Text that explains, after an Apply, why each node was rewritten. Pure: no React, no network.
// The reason comes from the hand-written dependency graph (explainAffected), never from the model.

import { explainAffected } from "../shared/dependencies";
import type { Edit, NodeId, State } from "../shared/types";

export const PARAM_LABEL: Record<Edit["param"], string> = {
  cls: "hero",
  power: "power",
  temperament: "temperament",
  gear: "gear",
};

export function labelOf(state: State, id: NodeId): string {
  return id === "overview" ? "the overview" : state.nodes[id].derived.name;
}

/** The edit as a clause: "you changed Brann’s power from 7 to 3", "you swapped Mira for Aldric". */
export function describeEdit(before: State, after: State, edit: Edit): string {
  const b = before.nodes[edit.cardId];
  const a = after.nodes[edit.cardId];
  if (edit.param === "cls") return `you swapped ${b.derived.name} for ${a.derived.name}`;
  return `you changed ${a.derived.name}’s ${PARAM_LABEL[edit.param]} from ${b.params[edit.param]} to ${a.params[edit.param]}`;
}

/**
 * Why `id` was rewritten by the last Apply, or null if it was not.
 * `changed` is the backend's list for that Apply. A changed node outside the edit's closure can
 * only come from the baseline (whole-party) update, and is labelled as such.
 */
export function attributionFor(
  before: State,
  after: State,
  edit: Edit,
  changed: readonly NodeId[],
  id: NodeId,
): string | null {
  if (!changed.includes(id)) return null;
  const why = explainAffected(edit).find((e) => e.id === id)?.why;
  if (!why) return "Rewritten by the whole-party update, though it doesn’t depend on your edit.";
  const what = describeEdit(before, after, edit);
  return why.kind === "edited"
    ? `Updated because ${what}.`
    : `Updated because it reads ${labelOf(after, why.from)}: ${what}.`;
}
