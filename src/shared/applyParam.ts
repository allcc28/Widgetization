import type { Edit, State } from "./types";
import { CARD_IDS, CLASSES, GEARS, POWER_MAX, POWER_MIN, TEMPERAMENTS } from "./types";

/** Set one param on one card. Returns a new state; never mutates. Does not touch content or derived. */
export function applyParam(state: State, edit: Edit): State {
  const card = state.nodes[edit.cardId];
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [edit.cardId]: { ...card, params: { ...card.params, [edit.param]: edit.value } },
    },
  };
}

/** Whether another card already uses this class (a hero can appear once per party). */
export function isClassTaken(state: State, cardId: Edit["cardId"], cls: string): boolean {
  return CARD_IDS.some((id) => id !== cardId && state.nodes[id].params.cls === cls);
}

/** Whether the edit is allowed on this state: value in range or in its fixed list, no duplicate hero. */
export function isEditAllowed(state: State, edit: Edit): boolean {
  switch (edit.param) {
    case "cls":
      return (CLASSES as readonly string[]).includes(edit.value) && !isClassTaken(state, edit.cardId, edit.value);
    case "power":
      return Number.isInteger(edit.value) && edit.value >= POWER_MIN && edit.value <= POWER_MAX;
    case "temperament":
      return (TEMPERAMENTS as readonly string[]).includes(edit.value);
    case "gear":
      return (GEARS as readonly string[]).includes(edit.value);
  }
}
