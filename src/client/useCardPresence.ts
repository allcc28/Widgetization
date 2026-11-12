import { useRef, type FocusEvent } from "react";
import type { NodeId } from "../shared/types";
import { logEvent } from "./logger";

/**
 * Handlers that log `card_enter` / `card_leave` for one card.
 * Pointer and keyboard focus are tracked separately; an enter is logged when the card
 * becomes active by either, and a leave only when both are gone, so there are no
 * overlapping or duplicate pairs. Focus moving between controls inside the card is ignored.
 */
export function useCardPresence(cardId: NodeId) {
  const active = useRef({ pointer: false, focus: false });

  function set(source: "pointer" | "focus", value: boolean) {
    const was = active.current.pointer || active.current.focus;
    active.current[source] = value;
    const now = active.current.pointer || active.current.focus;
    if (!was && now) logEvent({ type: "card_enter", cardId });
    if (was && !now) logEvent({ type: "card_leave", cardId });
  }

  const movesWithin = (e: FocusEvent<HTMLElement>) =>
    e.currentTarget.contains(e.relatedTarget as Node | null);

  return {
    onMouseEnter: () => set("pointer", true),
    onMouseLeave: () => set("pointer", false),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (!movesWithin(e)) set("focus", true);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!movesWithin(e)) set("focus", false);
    },
  };
}
