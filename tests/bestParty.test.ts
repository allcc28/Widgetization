import { describe, expect, it } from "vitest";
import { BEST_MAX, compareParties, partyKey, recordBest } from "../src/client/bestParty";
import { applyParam } from "../src/shared/applyParam";
import { withDerived } from "../src/shared/derived";
import { sampleState } from "../src/shared/sampleState";
import type { Edit, Rating, State } from "../src/shared/types";

const base = withDerived(sampleState);
const edited = (edit: Edit, from: State = base) => withDerived(applyParam(from, edit));

/** A copy whose overview is forced to a rating and a number of met requirements. */
function forced(rating: Rating, met: number, from: State = base): State {
  const d = from.nodes.overview.derived;
  const requirements = [0, 1].map((i) => ({ text: `req ${i}`, met: i < met }));
  return { ...from, nodes: { ...from.nodes, overview: { ...from.nodes.overview, derived: { ...d, rating, requirements } } } };
}

describe("compareParties", () => {
  it("prefers the better rating", () => {
    expect(compareParties(forced("A", 0), forced("B", 2))).toBeGreaterThan(0);
  });
  it("breaks a rating tie by requirements met", () => {
    expect(compareParties(forced("B", 2), forced("B", 1))).toBeGreaterThan(0);
  });
  it("ties when both are equal", () => {
    expect(compareParties(forced("B", 1), forced("B", 1))).toBe(0);
  });
});

describe("partyKey", () => {
  it("depends on the params only, not on the text", () => {
    const retold = { ...base, nodes: { ...base.nodes, card_1: { ...base.nodes.card_1, content: { backstory: "x", abilities: [] } } } };
    expect(partyKey(retold)).toBe(partyKey(base));
    expect(partyKey(edited({ cardId: "card_1", param: "power", value: 2 }))).not.toBe(partyKey(base));
  });
});

describe("recordBest", () => {
  it("starts with the first party seen", () => {
    expect(recordBest([], base)).toEqual([base]);
  });
  it("keeps the list unchanged (same reference) when the candidate is worse", () => {
    const best = [forced("A", 1)];
    expect(recordBest(best, forced("B", 2))).toBe(best);
  });
  it("replaces the list when the candidate is better", () => {
    const better = forced("S", 0);
    expect(recordBest([forced("A", 2), forced("A", 2, edited({ cardId: "card_1", param: "power", value: 2 }))], better)).toEqual([better]);
  });
  it("keeps ties, newest first, deduplicated by params", () => {
    const a = forced("B", 1);
    const b = forced("B", 1, edited({ cardId: "card_1", param: "power", value: 2 }));
    const aAgain = forced("B", 1, { ...a, nodes: { ...a.nodes, overview: { ...a.nodes.overview, content: { summary: "new" } } } });
    let best = recordBest([], a);
    best = recordBest(best, b);
    expect(best).toEqual([b, a]);
    best = recordBest(best, aAgain);
    expect(best).toEqual([aAgain, b]);
  });
  it("keeps at most BEST_MAX ties", () => {
    let best: readonly State[] = [];
    for (let power = 1; power <= BEST_MAX + 2; power++) {
      best = recordBest(best, forced("B", 1, edited({ cardId: "card_1", param: "power", value: power })));
    }
    expect(best).toHaveLength(BEST_MAX);
    expect(best[0]?.nodes.card_1.params.power).toBe(BEST_MAX + 2);
  });
});
