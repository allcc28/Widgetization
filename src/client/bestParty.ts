// The "best party so far" record: pure functions, no UI, no backend.
// A party is judged by its rating (S best), then by how many quest requirements it meets.
// Ties are all kept (newest first, at most BEST_MAX), deduplicated by the three heroes' params.

import { CARD_IDS, RATINGS, type State } from "../shared/types";

export const BEST_MAX = 3;

/** Higher is better in both fields. */
export function scoreOf(state: State): { grade: number; met: number } {
  const d = state.nodes.overview.derived;
  return {
    grade: RATINGS.length - 1 - RATINGS.indexOf(d.rating),
    met: d.requirements.filter((r) => r.met).length,
  };
}

/** Positive when `a` is the better party, negative when `b` is, 0 when they tie. */
export function compareParties(a: State, b: State): number {
  const sa = scoreOf(a);
  const sb = scoreOf(b);
  return sa.grade - sb.grade || sa.met - sb.met;
}

/** What makes two parties "the same": the three heroes' params. The text is not compared. */
export function partyKey(state: State): string {
  return CARD_IDS.map((id) => {
    const p = state.nodes[id].params;
    return `${p.cls}/${p.power}/${p.temperament}/${p.gear}`;
  }).join("|");
}

/**
 * The best list after seeing `candidate`. Newest first. Returns the same array when the
 * candidate is worse than the current best, so callers can skip a re-render.
 */
export function recordBest(best: readonly State[], candidate: State): readonly State[] {
  const top = best[0];
  if (!top) return [candidate];
  const cmp = compareParties(candidate, top);
  if (cmp < 0) return best;
  if (cmp > 0) return [candidate];
  const key = partyKey(candidate);
  // A tie with the same params replaces the older copy (the text may be newer).
  return [candidate, ...best.filter((s) => partyKey(s) !== key)].slice(0, BEST_MAX);
}
