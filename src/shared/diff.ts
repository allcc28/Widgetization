import { NODE_IDS, type NodeId, type State } from "./types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Which fields of one node differ between two states, for field-level highlighting.
 * Cards: power, temperament, gear, attack, defense, backstory, abilities. Overview: totals, rating, findings, summary.
 */
export function changedFieldsOf(before: State, after: State, id: NodeId): string[] {
  const out: string[] = [];
  if (id === "overview") {
    const b = before.nodes.overview;
    const a = after.nodes.overview;
    if (b.derived.totalPower !== a.derived.totalPower) out.push("totalPower");
    if (b.derived.totalAttack !== a.derived.totalAttack) out.push("totalAttack");
    if (b.derived.totalDefense !== a.derived.totalDefense) out.push("totalDefense");
    if (b.derived.rating !== a.derived.rating) out.push("rating");
    if (!deepEqual(b.derived.findings, a.derived.findings)) out.push("findings");
    if (!deepEqual(b.derived.requirements, a.derived.requirements)) out.push("requirements");
    if (b.content.summary !== a.content.summary) out.push("summary");
    return out;
  }
  const b = before.nodes[id];
  const a = after.nodes[id];
  if (b.params.cls !== a.params.cls) out.push("cls");
  if (b.derived.name !== a.derived.name) out.push("name");
  if (b.params.power !== a.params.power) out.push("power");
  if (b.params.temperament !== a.params.temperament) out.push("temperament");
  if (b.params.gear !== a.params.gear) out.push("gear");
  if (b.derived.attack !== a.derived.attack) out.push("attack");
  if (b.derived.defense !== a.derived.defense) out.push("defense");
  if (b.content.backstory !== a.content.backstory) out.push("backstory");
  if (!deepEqual(b.content.abilities, a.content.abilities)) out.push("abilities");
  return out;
}

/** IDs of nodes that are not deep-equal between the two states, in canonical order. */
export function diff(before: State, after: State): NodeId[] {
  return NODE_IDS.filter((id) => !deepEqual(before.nodes[id], after.nodes[id]));
}
