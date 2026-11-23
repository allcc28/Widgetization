// Role II's swap repair (ollamaClient.generateContent), with deterministic fetch mocks.
import { afterEach, expect, it, vi } from "vitest";
import { generateContent } from "../src/backend/ollamaClient";
import { sampleState } from "../src/shared/sampleState";

afterEach(() => vi.unstubAllGlobals());

const request = () => ({
  mode: "bounded" as const,
  state: structuredClone(sampleState),
  edit: { cardId: "card_1" as const, param: "cls" as const, value: "Mage" as const },
});
const reply = (nodes: unknown) => Response.json({ message: { content: JSON.stringify({ nodes }) } });
const overview = { content: { summary: "Orin now leads the party." } };
const stale = { card_1: { content: sampleState.nodes.card_1.content }, overview };
const orin = { content: { backstory: "Orin studies storms from a ruined tower.", abilities: ["Frost lance", "Arcane shield"] } };

function mockFetch(...steps: ((init?: RequestInit) => Response)[]) {
  let call = 0;
  const send = vi.fn<typeof fetch>(async (_url, init) => steps[call++]!(init));
  vi.stubGlobal("fetch", send);
  return send;
}

it("repairs a stale swapped card and keeps the first overview; logs the steps without content", async () => {
  const send = mockFetch(() => reply(stale), () => reply({ card_1: orin }));
  const log = vi.fn();
  expect(await generateContent(request(), undefined, log)).toEqual({ ok: true, nodes: { card_1: orin, overview } });
  expect(send).toHaveBeenCalledTimes(2);
  expect(log.mock.calls.map(([event]) => event)).toEqual(["ollama.main", "identity.fail", "repair.result"]);
  expect(log.mock.calls[2]![1]).toMatchObject({ ok: true, usable: true });
  const logged = JSON.stringify(log.mock.calls);
  for (const text of [orin.content.backstory, stale.card_1.content.backstory, overview.content.summary]) expect(logged).not.toContain(text);
});

it("fails with MODEL_ERROR when the repaired card is still stale", async () => {
  const send = mockFetch(() => reply(stale), () => reply({ card_1: stale.card_1 }));
  expect(await generateContent(request())).toMatchObject({ ok: false, error: { code: "MODEL_ERROR" } });
  expect(send).toHaveBeenCalledTimes(2);
});

it("returns INVALID_JSON when the repair is malformed", async () => {
  mockFetch(() => reply(stale), () => Response.json({ message: { content: "{" } }));
  expect(await generateContent(request())).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
});

it("rejects with AbortError when the caller aborts during the repair", async () => {
  const controller = new AbortController();
  mockFetch(() => reply(stale), (init) => {
    controller.abort();
    init!.signal!.throwIfAborted();
    throw new Error("abort was not forwarded to the repair call");
  });
  await expect(generateContent(request(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
