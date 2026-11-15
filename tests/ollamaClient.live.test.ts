import { expect, it } from "vitest";
import { generateContent } from "../src/backend/ollamaClient";
import { sampleState } from "../src/shared/sampleState";
import { NODE_IDS } from "../src/shared/types";

const liveTest = it.skipIf(import.meta.env.VITE_RUN_OLLAMA_TEST !== "1");
const edit = { cardId: "card_2", param: "power", value: 4 } as const;

async function checkUpdate(mode: "bounded" | "baseline") {
  const state = structuredClone(sampleState);
  const result = await generateContent({ mode, state, edit });
  if (!result.ok) {
    throw new Error(result.error.code + ": " + result.error.message);
  }

  const expected = mode === "bounded" ? ["card_2", "overview"] : [...NODE_IDS];
  expect(Object.keys(result.nodes).sort()).toEqual(expected.sort());

  const changed = NODE_IDS.filter((id) => {
    if (id === "overview") {
      return result.nodes.overview?.content.summary !== sampleState.nodes.overview.content.summary;
    }
    const current = result.nodes[id]?.content;
    if (!current) return false;
    const previous = sampleState.nodes[id].content;
    return current.backstory !== previous.backstory ||
      current.abilities.length !== previous.abilities.length ||
      current.abilities.some((ability, i) => ability !== previous.abilities[i]);
  });

  expect(result.nodes.card_2?.content.backstory).toMatch(/\S/);
  expect(result.nodes.card_2?.content.abilities.length).toBeGreaterThan(0);
  expect(result.nodes.overview?.content.summary).toMatch(/\S/);
  expect(state).toEqual(sampleState);

  console.log(JSON.stringify({
    mode,
    returnedNodes: Object.keys(result.nodes),
    changedContent: changed,
    offScopeChanges: changed.filter(id => id === "card_1" || id === "card_3"),
    nodes: result.nodes,
  }, null, 2));
}

liveTest("bounded: lowering Brann's power returns only his card and the overview", async () => {
  await checkUpdate("bounded");
}, 130_000);

liveTest("baseline: lowering Brann's power returns the full party", async () => {
  await checkUpdate("baseline");
}, 130_000);
