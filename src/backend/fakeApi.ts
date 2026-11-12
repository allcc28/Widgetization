// FAKE backend so the UI can be built before the real one exists (the backend roles own the real one).
// Same names and result shapes as contracts.md. Replace by the real module; the UI should not change.
// Add ?fail to the page URL to make every update fail, to see the error state.

import { applyParam, isEditAllowed } from "../shared/applyParam";
import { affectedSet } from "../shared/dependencies";
import { withDerived } from "../shared/derived";
import { diff } from "../shared/diff";
import { HERO_NAME } from "../shared/heroes";
import type { CharacterClass, NodeId, State, Edit, UpdateResult } from "../shared/types";

const FAKE_DELAY_MS = 800;
const history: State[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shouldFail(): boolean {
  return typeof location !== "undefined" && new URLSearchParams(location.search).has("fail");
}

function invalidEdit(state: State): UpdateResult {
  return {
    ok: false,
    state,
    error: { code: "INVALID_EDIT", message: "That change is not allowed (out of range or duplicate hero)." },
    latencyMs: 0,
  };
}

function fakeFailure(state: State, start: number): UpdateResult {
  return {
    ok: false,
    state,
    error: { code: "MODEL_ERROR", message: "Fake failure (remove ?fail from the URL)." },
    latencyMs: Date.now() - start,
  };
}

// Stand-in prose for a freshly chosen hero. The real model writes this from the new class.
const FAKE_HERO: Record<CharacterClass, { backstory: string; abilities: string[] }> = {
  Ranger: { backstory: "keeps to the high ground and trusts a long bow over any oath.", abilities: ["Longbow volley", "Track prey"] },
  Berserker: { backstory: "fights as though every wound were a debt owed.", abilities: ["Whirling axe", "Battle cry"] },
  Cleric: { backstory: "tends the wounded by moonlight and keeps a quiet vigil.", abilities: ["Mend wounds", "Ward"] },
  Mage: { backstory: "studies the old star charts and speaks little of what they show.", abilities: ["Arc bolt", "Mana shield"] },
  Rogue: { backstory: "learned early that doors are only suggestions.", abilities: ["Backstab", "Smoke step"] },
  Paladin: { backstory: "wears a borrowed oath like armour, and has never once taken it off.", abilities: ["Shield wall", "Smite"] },
  Bard: { backstory: "carries every story the party has lived and tells them better each time.", abilities: ["Rally song", "Sharp wit"] },
  Druid: { backstory: "speaks for the old wood and listens when it answers.", abilities: ["Thorn snare", "Stone skin"] },
};

function fakeRewrite(state: State, ids: NodeId[], edit?: Edit): State {
  const nodes = { ...state.nodes };
  for (const id of ids) {
    const node = nodes[id];
    if (edit?.param === "cls" && id === edit.cardId) {
      const hero = FAKE_HERO[edit.value];
      nodes[edit.cardId] = {
        ...nodes[edit.cardId],
        content: { backstory: `${HERO_NAME[edit.value]} ${hero.backstory}`, abilities: hero.abilities },
      };
      continue;
    }
    nodes[id] = {
      ...node,
      content: { ...node.content, ...("backstory" in node.content
        ? { backstory: `${node.content.backstory} (revised)` }
        : { summary: `${(node.content as { summary: string }).summary} (revised)` }) },
    } as never;
  }
  return { ...state, nodes };
}

export async function applyEdit(state: State, edit: Edit): Promise<UpdateResult> {
  const start = Date.now();
  if (!isEditAllowed(state, edit)) return invalidEdit(state);
  if (state.nodes[edit.cardId].params[edit.param] === edit.value) {
    return { ok: true, state, affected: affectedSet(edit), changed: [], latencyMs: 0 };
  }
  await sleep(FAKE_DELAY_MS);
  if (shouldFail()) return fakeFailure(state, start);
  const affected = affectedSet(edit);
  const next = withDerived(fakeRewrite(applyParam(state, edit), affected, edit));
  history.push(state);
  return { ok: true, state: next, affected, changed: diff(state, next), latencyMs: Date.now() - start };
}

/** Fake baseline: rewrites every node, simulating a model that ignores "keep everything else unchanged", so off-scope changes appear. */
export async function regenerateAll(state: State, edit: Edit): Promise<UpdateResult> {
  const start = Date.now();
  if (!isEditAllowed(state, edit)) return invalidEdit(state);
  await sleep(FAKE_DELAY_MS);
  if (shouldFail()) return fakeFailure(state, start);
  const affected = affectedSet(edit);
  const next = withDerived(
    fakeRewrite(applyParam(state, edit), ["card_1", "card_2", "card_3", "overview"], edit),
  );
  history.push(state);
  return { ok: true, state: next, affected, changed: diff(state, next), latencyMs: Date.now() - start };
}

export function undo(): State | null {
  return history.pop() ?? null;
}
export function canUndo(): boolean {
  return history.length > 0;
}
export function resetHistory(): void {
  history.length = 0;
}
