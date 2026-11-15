import type { CardId, CardNode, OverviewNode } from "../shared/types";

type CardOutput = Pick<CardNode, "content">;
type OverviewOutput = Pick<OverviewNode, "content">;

export type BoundedOutput<Id extends CardId> = {
  nodes: Record<Id, CardOutput> & {
    overview: OverviewOutput;
  };
};

export type FullPartyOutput = {
  nodes: Record<CardId, CardOutput> & {
    overview: OverviewOutput;
  };
};

// Example response when Brann's power changes from 7 to 4.
export const boundedExample = {
  nodes: {
    card_2: {
      content: {
        backstory:
          "Brann once held the gate alone. Now he relies on his allies to hold the line.",
        abilities: ["Shield brace", "Cover an ally"],
      },
    },
    overview: {
      content: {
        summary:
          "Brann needs support on the front line, so the party must coordinate its defense.",
      },
    },
  },
} satisfies BoundedOutput<"card_2">;
