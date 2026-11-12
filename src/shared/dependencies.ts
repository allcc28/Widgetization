// Hand-authored dependency graph. Pure: no UI, no network.
// The LLM never decides what depends on what.

import { NODE_IDS, type Edit, type NodeId } from "./types";

type Target = "self" | NodeId;

// parameter -> nodes it directly affects ("self" = the edited card)
const PARAM_DEPS: Record<Edit["param"], Target[]> = {
  cls: ["self", "overview"],
  power: ["self", "overview"],
  temperament: ["self", "overview"],
  gear: ["self", "overview"],
};

// node -> nodes it reads; if a read node is affected, this node is affected too
const NODE_DEPS: Partial<Record<NodeId, NodeId[]>> = {
  overview: ["card_1", "card_2", "card_3"],
};

/** Dependency closure of an edit, in canonical node order, no duplicates. */
export function affectedSet(edit: Edit): NodeId[] {
  const out = new Set<NodeId>(
    PARAM_DEPS[edit.param].map((t) => (t === "self" ? edit.cardId : t)),
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const [node, reads] of Object.entries(NODE_DEPS) as [NodeId, NodeId[]][]) {
      if (!out.has(node) && reads.some((r) => out.has(r))) {
        out.add(node);
        changed = true;
      }
    }
  }

  return NODE_IDS.filter((id) => out.has(id));
}

/** Why a node is in the closure: it is the edited card, or it reads a node that is changing. */
export type Why = { kind: "edited" } | { kind: "reads"; from: NodeId };

/** `affectedSet(edit)` with a reason per node, in canonical order. For the preview text. */
export function explainAffected(edit: Edit): { id: NodeId; why: Why }[] {
  const why = new Map<NodeId, Why>();
  for (const t of PARAM_DEPS[edit.param]) {
    const id = t === "self" ? edit.cardId : t;
    why.set(id, id === edit.cardId ? { kind: "edited" } : { kind: "reads", from: edit.cardId });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [node, reads] of Object.entries(NODE_DEPS) as [NodeId, NodeId[]][]) {
      const from = reads.find((r) => why.has(r));
      if (!why.has(node) && from) {
        why.set(node, { kind: "reads", from });
        changed = true;
      }
    }
  }

  return NODE_IDS.filter((id) => why.has(id)).map((id) => ({ id, why: why.get(id) as Why }));
}
