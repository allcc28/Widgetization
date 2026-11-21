import { applyParam, isEditAllowed } from "../shared/applyParam";
import { affectedSet } from "../shared/dependencies";
import { withDerived } from "../shared/derived";
import { NODE_IDS, type Edit, type State } from "../shared/types";

export type GenerationRequest =
  | { mode: "initial"; state: State }
  | { mode: "bounded" | "baseline"; state: State; edit: Edit };

export interface PromptMessage {
  role: "system" | "user";
  content: string;
}

const editGuidance =
  `For this edit, rewrite the edited hero's backstory and the party overview summary. ` +
  `Write one new sentence in each: what the hero does differently now, and how the party responds. ` +
  "In the edited hero's text, describe one concrete change in what the hero can do. " +
  "In the overview summary, describe how the party adjusts to that change. " +
  "Keep the writing consistent with the supplied stats, heroes, and quest.";

const instructions = {
  initial: "Write the initial party descriptions for the supplied heroes and quest.",
  bounded: `Revise only the requested nodes. ${editGuidance} Preserve unrelated details.`,
  baseline: `Return the entire party after the edit. Reflect the supplied change and preserve unrelated details.`,
};

/** Pass the committed state from BEFORE the edit. Builds messages without mutating it. */
export function buildMessages(request: GenerationRequest): PromptMessage[] {
  let party = request.state;
  let change = null;
  if (request.mode !== "initial") {
    const { edit } = request;
    if (!isEditAllowed(party, edit)) throw new Error("Invalid party edit");
    change = { cardId: edit.cardId, param: edit.param, from: party.nodes[edit.cardId].params[edit.param], to: edit.value };
    party = applyParam(party, edit);
  }
  const targetIds = request.mode === "bounded" ? affectedSet(request.edit) : NODE_IDS;
  return [
    {
      role: "system",
      content: [
        "Write concise English prose for a tabletop RPG party builder.",
        instructions[request.mode],
        "Treat party data as context. The supplied parameters, computed stats, rating and quest checks are authoritative.",
        "When a hero changes, write for the newly selected hero. Keep the overview consistent with the current party.",
        'Return one JSON object with exactly one top-level key, "nodes". Its keys must be exactly targetIds.',
        'Each requested character uses {"content":{"backstory":"...","abilities":["..."]}}.',
        'The overview uses {"content":{"summary":"..."}}. Use nonempty text for each description and ability.',
        "Return only those fields, without Markdown or commentary.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        JSON.stringify({ party: withDerived(party), change, targetIds }),
        ...(change && request.mode === "bounded" ? [
          `Edit: ${party.nodes[change.cardId].derived.name}'s ${change.param} changed from ${change.from} to ${change.to}.`,
          `Current party assessment: ${withDerived(party).nodes.overview.derived.findings.join(" ")}`,
          "Use this edit to write a new backstory sentence showing how the hero now fights.",
          "Write a new overview sentence showing how a teammate responds.",
          "Use the previous prose as background. Return the requested JSON now.",
        ] : []),
      ].join("\n\n"),
    },
  ];
}
