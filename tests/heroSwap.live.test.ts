import { expect, it } from "vitest";
import { generateContent } from "../src/backend/ollamaClient";
import { sampleState } from "../src/shared/sampleState";
import { NODE_IDS } from "../src/shared/types";

for (const mode of ["bounded", "baseline"] as const) {
  it.skipIf(import.meta.env.VITE_RUN_OLLAMA_TEST !== "1")(
    mode + ": replacing Mira with Orin produces new hero content",
    async () => {
      const result = await generateContent({
        mode,
        state: structuredClone(sampleState),
        edit: { cardId: "card_1", param: "cls", value: "Mage" },
      });
      if (!result.ok) throw new Error(result.error.code + ": " + result.error.message);
      console.log(mode, JSON.stringify(result.nodes, null, 2));
      const ids = mode === "bounded" ? ["card_1", "overview"] : [...NODE_IDS];
      expect(Object.keys(result.nodes).sort()).toEqual(ids.sort());
      const hero = result.nodes.card_1?.content;
      if (!hero) throw new Error("Missing content for Orin");
      const normalized = (items: string[]) =>
        JSON.stringify(items.map(item => item.trim().toLowerCase()).sort());
      const copiedFrom: string[] = [];
      const offScopeChangedFields: string[] = [];
      for (const id of ["card_2", "card_3"] as const) {
        const previous = sampleState.nodes[id].content;
        if (normalized(hero.abilities) === normalized(previous.abilities)) {
          copiedFrom.push(sampleState.nodes[id].derived.name);
        }
        const current = result.nodes[id]?.content;
        if (!current) continue;
        if (current.backstory !== previous.backstory) offScopeChangedFields.push(id + ".backstory");
        if (JSON.stringify(current.abilities) !== JSON.stringify(previous.abilities)) {
          offScopeChangedFields.push(id + ".abilities");
        }
      }
      console.log(JSON.stringify({ mode, copiedFrom, offScopeChangedFields }, null, 2));
      expect(copiedFrom, "Orin copied a teammate's entire ability list").toEqual([]);
      const original = sampleState.nodes.card_1.content;
      expect(hero.backstory.trim(), "The old Ranger backstory was copied").not.toBe(original.backstory.trim());
      expect(hero.abilities, "The entire Ranger ability list was copied").not.toEqual(original.abilities);
      expect(hero.backstory, "The description still introduces Mira as the hero").not.toMatch(/^\s*Mira\b/i);
    },
    130_000,
  );
}
