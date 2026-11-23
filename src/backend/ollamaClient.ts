import { HERO_NAME } from "../shared/heroes";
import { buildMessages, type GenerationRequest } from "./prompts";
import { affectedSet } from "../shared/dependencies";
import { applyParam } from "../shared/applyParam";
import { withDerived } from "../shared/derived";
import { CLASSES, ROLES, NODE_IDS, type ErrorCode, type NodeId } from "../shared/types";
import type { FullPartyOutput } from "./modelOutput";

type Nodes = FullPartyOutput["nodes"];
export type GenerationResult =
  | { ok: true; nodes: Partial<Nodes> }
  | { ok: false; error: { code: ErrorCode; message: string } };

const failure = (code: ErrorCode, message: string): GenerationResult =>
  ({ ok: false, error: { code, message } });

function objectSchema(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

function schemaFor(ids: readonly NodeId[]) {
  const text = { type: "string", minLength: 1 };
  const card = objectSchema({ backstory: text, abilities: { type: "array", items: text, minItems: 1 } });
  const overview = objectSchema({ summary: text });
  return objectSchema({
    nodes: objectSchema(Object.fromEntries(ids.map(id =>
      [id, objectSchema({ content: id === "overview" ? overview : card })]))),
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === expected.length &&
    expected.every(key => Object.hasOwn(value, key));
}

const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function validate(value: unknown, ids: readonly NodeId[]): GenerationResult {
  const invalid = () => failure("SCHEMA_MISMATCH", "The generated fields do not match the requested schema.");
  if (!keys(value, ["nodes"]) || !record(value.nodes)) return invalid();
  if (Object.keys(value.nodes).some(id => !ids.some(expected => expected === id))) {
    return failure("OFF_SCOPE_ID", "The model returned an unexpected node.");
  }
  if (!keys(value.nodes, ids)) return invalid();
  const nodes: Partial<Nodes> = {};
  for (const id of ids) {
    const node = value.nodes[id];
    if (!keys(node, ["content"])) return invalid();
    const c = node.content;
    if (id === "overview") {
      if (!keys(c, ["summary"]) || !nonempty(c.summary)) return invalid();
      nodes.overview = { content: { summary: c.summary } };
    } else {
      if (!keys(c, ["backstory", "abilities"]) || !nonempty(c.backstory) ||
          !Array.isArray(c.abilities) || !c.abilities.length || !c.abilities.every(nonempty)) return invalid();
      nodes[id] = { content: { backstory: c.backstory, abilities: c.abilities } };
    }
  }
  return { ok: true, nodes };
}

async function attempt(messages: ReturnType<typeof buildMessages>, ids: readonly NodeId[], callerSignal?: AbortSignal): Promise<GenerationResult> {
  const deadline = AbortSignal.timeout(60000);
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:0.5b", messages, format: schemaFor(ids), stream: false,
        options: { temperature: 0.2 },
      }),
      signal,
    });
    if (!response.ok) return failure("MODEL_ERROR", "Ollama returned HTTP " + response.status);
    const envelope: unknown = await response.json();
    if (!record(envelope) || !record(envelope.message) || typeof envelope.message.content !== "string") {
      return failure("MODEL_ERROR", "Ollama returned an incomplete chat response.");
    }
    return validate(JSON.parse(envelope.message.content), ids);
  } catch (error) {
    if (callerSignal?.aborted) throw callerSignal.reason ?? new DOMException("Request cancelled", "AbortError");
    if (signal.aborted) return failure("TIMEOUT", "Ollama took longer than 60 seconds.");
    if (error instanceof SyntaxError) return failure("INVALID_JSON", "Ollama returned invalid JSON.");
    return failure("MODEL_ERROR", "Could not reach the local Ollama server.");
  }
}

function invalidIdentity(story: string, abilities: string[], name: string, cls: string): boolean {
  const claims = story.matchAll(new RegExp("\\b" + name + "\\s+(?:is|was|became)\\s+(?:an?\\s+)?(\\w+)", "gi"));
  const classes = CLASSES.map(value => value.toLowerCase());
  for (const claim of claims) {
    const stated = claim[1]?.toLowerCase();
    if (stated && classes.includes(stated) && stated !== cls.toLowerCase()) return true;
  }
  return abilities.some(value => ROLES.some(role => role.toLowerCase() === value.trim().toLowerCase()));
}

/** Dev-only structured log sink: ids, codes and timings only, never prompts or content. */
export type GenerationLog = (event: string, fields?: Record<string, unknown>) => void;
const codeOf = (r: GenerationResult) => (r.ok ? {} : { code: r.error.code });

/** Pass committed state. A rejected swap card gets one isolated repair before the backend retries. */
export async function generateContent(request: GenerationRequest, signal?: AbortSignal, log: GenerationLog = () => {}): Promise<GenerationResult> {
  let messages: ReturnType<typeof buildMessages>;
  try {
    messages = buildMessages(request);
  } catch {
    return failure("INVALID_EDIT", "Invalid party state or edit.");
  }
  const ids = request.mode === "bounded" ? affectedSet(request.edit) : NODE_IDS;
  const swap = request.mode !== "initial" && request.edit.param === "cls" &&
    request.state.nodes[request.edit.cardId].params.cls !== request.edit.value ? request.edit : null;
  if (swap) {
    const draft = structuredClone(request.state);
    draft.nodes[swap.cardId].content = { backstory: "", abilities: [] };
    messages = buildMessages({ ...request, state: draft });
    messages.push({ role: "user", content:
      `A new hero joins: ${HERO_NAME[swap.value]} the ${swap.value}. For ${swap.cardId}, begin the new backstory with ${HERO_NAME[swap.value]} and invent two named ${swap.value} abilities. ${request.mode === "bounded" ? "Write a party summary consistent with the new roster. " : ""}Return the requested nodes.` });
  }
  const powerEdit = request.mode !== "initial" && request.edit.param === "power"
    && request.edit.value !== request.state.nodes[request.edit.cardId].params.power
    ? request.edit : null;

  {
    let t = Date.now();
    const result = await attempt(messages, ids, signal);
    log("ollama.main", { ok: result.ok, ...codeOf(result), ms: Date.now() - t });
    if (!result.ok) return result;
    if (swap) {
      const id = swap.cardId;
      const name = HERO_NAME[swap.value];
      const normalize = (value: string) => value.trim().toLowerCase();
      const signature = (items: string[]) => JSON.stringify(items.map(normalize).sort());
      const old = request.state.nodes[id].content;
      const abilityLists = NODE_IDS.flatMap(key => key === "overview" ? [] :
        [signature(request.state.nodes[key].content.abilities)]);
      const usable = (card: Nodes[typeof id] | undefined) => {
        if (!card) return false;
        const { backstory, abilities } = card.content;
        return new RegExp("\\b" + name + "\\b", "i").test(backstory) &&
          normalize(backstory) !== normalize(old.backstory) &&
          abilities.some(a => !old.abilities.map(normalize).includes(normalize(a))) &&
          !abilityLists.includes(signature(abilities)) &&
          !invalidIdentity(backstory, abilities, name, swap.value);
      };
      if (usable(result.nodes[id])) return result;
      log("identity.fail", { card: id, kind: "swap" });
      t = Date.now();
      const party = withDerived(applyParam(request.state, swap));
      const { params, derived } = party.nodes[id];
      const { quest } = party;
      const repair = await attempt([
        {
          role: "system",
          content: 'Write one RPG hero card in English. Return {"nodes":{"<cardId>":{"content":{"backstory":"...","abilities":["...","..."]}}}} using the supplied cardId. Start the backstory with the hero name and write one sentence about the hero. Give two distinct, short ability names suited to the class.',
        },
        {
          role: "user",
          content: JSON.stringify({ cardId: id, name, params, derived, quest }),
        },
      ], [id], signal);
      log("repair.result", { ok: repair.ok, ...codeOf(repair), usable: repair.ok && usable(repair.nodes[id]), ms: Date.now() - t });
      if (!repair.ok) return repair;
      const card = repair.nodes[id];
      if (card && usable(card)) {
        return { ok: true, nodes: { ...result.nodes, [id]: card } };
      }
      return failure("MODEL_ERROR", "The replacement hero has stale, borrowed, or inconsistent content.");
    }
    if (!powerEdit) return result;
    const oldCard = request.state.nodes[powerEdit.cardId];
    const generated = result.nodes[powerEdit.cardId]?.content;
    const borrowed = NODE_IDS.some(id => {
      if (!generated || id === "overview" || id === powerEdit.cardId) return false;
      const other = request.state.nodes[id].content;
      return generated.backstory.trim() === other.backstory.trim() ||
        generated.abilities.some(a => other.abilities.includes(a) && !oldCard.content.abilities.includes(a));
    });
    if (generated && !borrowed &&
        !invalidIdentity(generated.backstory, generated.abilities, oldCard.derived.name, oldCard.params.cls)) return result;

  }
  log("identity.fail", { card: powerEdit?.cardId, kind: "power" });
  return failure("MODEL_ERROR", "Power edit failed: generated content conflicts with the edited hero identity or copies a teammate.");
}
