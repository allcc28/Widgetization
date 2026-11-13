// Role III: validation of model output. Pure: no I/O, no UI.
// parseOutput is the only schema-dependent part (swap it when Role II's schema lands);
// checkOutput enforces the contract rules (contracts.md 2.4-2.5, spec.md section 6).

import {
  CARD_IDS,
  CLASSES,
  GEARS,
  POWER_MAX,
  POWER_MIN,
  TEMPERAMENTS,
  type CardNode,
  type ErrorCode,
  type NodeId,
  type OverviewNode,
  type State,
  type UpdateError,
} from "../shared/types";

export type Content = CardNode["content"] | OverviewNode["content"];
export type Check<T> = { ok: true; value: T } | { ok: false; error: UpdateError };

/** Model output after parsing. Unknown ids are kept (content unchecked) so checkOutput can name them OFF_SCOPE_ID. */
export interface ParsedOutput {
  nodes: Record<string, { params?: Record<string, unknown>; content: Content }>;
  quest?: unknown;
}

const fail = (code: ErrorCode, message: string) => ({ ok: false as const, error: { code, message } });
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCardId = (id: string) => (CARD_IDS as readonly string[]).includes(id);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Raw model text -> ParsedOutput, or INVALID_JSON / SCHEMA_MISMATCH.
 * Working shape: { nodes: { <id>: { params?, content } }, quest? }; `derived` and unknown fields are dropped.
 * shortcut: working shape until Role II's schema exists (OI-2); replace this function only.
 */
export function parseOutput(raw: string): Check<ParsedOutput> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return fail("INVALID_JSON", `Model output is not JSON: ${(e as Error).message}`);
  }
  if (!isObj(json) || !isObj(json.nodes)) return fail("SCHEMA_MISMATCH", "Expected an object with a `nodes` object.");

  const nodes: ParsedOutput["nodes"] = {};
  for (const [id, node] of Object.entries(json.nodes)) {
    if (!isObj(node)) return fail("SCHEMA_MISMATCH", `Node ${id} is not an object.`);
    const { params, content: c } = node;
    if (params !== undefined && !isObj(params)) return fail("SCHEMA_MISMATCH", `${id}.params is not an object.`);
    let content: Content;
    if (id === "overview") {
      if (!isObj(c) || typeof c.summary !== "string") return fail("SCHEMA_MISMATCH", "overview.content.summary must be a string.");
      content = { summary: c.summary };
    } else if (isCardId(id)) {
      if (!isObj(c) || typeof c.backstory !== "string" || !Array.isArray(c.abilities) || !c.abilities.every((a) => typeof a === "string"))
        return fail("SCHEMA_MISMATCH", `${id}.content needs a string backstory and a string[] abilities.`);
      content = { backstory: c.backstory, abilities: c.abilities as string[] };
    } else {
      content = c as Content; // unknown id: rejected by checkOutput
    }
    nodes[id] = params === undefined ? { content } : { params, content };
  }
  return { ok: true, value: "quest" in json ? { nodes, quest: json.quest } : { nodes } };
}

const IN_RANGE: Record<string, (v: unknown) => boolean> = {
  cls: (v) => (CLASSES as readonly unknown[]).includes(v),
  power: (v) => Number.isInteger(v) && (v as number) >= POWER_MIN && (v as number) <= POWER_MAX,
  temperament: (v) => (TEMPERAMENTS as readonly unknown[]).includes(v),
  gear: (v) => (GEARS as readonly unknown[]).includes(v),
};

/**
 * Contract checks on parsed output. `expected` is the state after the edit (app-set params, original quest);
 * `ids` are the nodes the model was asked for (bounded: affectedSet(edit); baseline: all four).
 * Returns only the content of those nodes: params and derived are never read from the model.
 */
export function checkOutput(
  parsed: ParsedOutput,
  ctx: { expected: State; ids: NodeId[] },
): Check<Partial<Record<NodeId, Content>>> {
  const extra = Object.keys(parsed.nodes).filter((id) => !(ctx.ids as string[]).includes(id));
  if (extra.length) return fail("OFF_SCOPE_ID", `Returned ids outside the allowed set: ${extra.join(", ")}.`);
  const missing = ctx.ids.filter((id) => !Object.hasOwn(parsed.nodes, id));
  if (missing.length) return fail("SCHEMA_MISMATCH", `Missing ids: ${missing.join(", ")}.`);

  for (const id of ctx.ids) {
    const params = parsed.nodes[id]!.params;
    if (params === undefined) continue;
    if (id === "overview") return fail("PARAM_MISMATCH", "The overview has no params.");
    const bad = Object.keys(params).find((k) => IN_RANGE[k]?.(params[k]) === false);
    if (bad) return fail("OUT_OF_RANGE", `${id}.params.${bad} is out of range: ${JSON.stringify(params[bad])}.`);
    const want = ctx.expected.nodes[id].params as Record<string, unknown>;
    const diff = Object.keys(params).find((k) => want[k] !== params[k]);
    if (diff) return fail("PARAM_MISMATCH", `${id}.params.${diff} differs from the app-set value.`);
  }
  if ("quest" in parsed && !deepEqual(parsed.quest, ctx.expected.quest))
    return fail("PARAM_MISMATCH", "The quest was changed.");

  return { ok: true, value: Object.fromEntries(ctx.ids.map((id) => [id, parsed.nodes[id]!.content])) };
}
