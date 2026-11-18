import { afterEach, expect, it, vi } from "vitest";
import { generateContent } from "../src/backend/ollamaClient";
import { sampleState } from "../src/shared/sampleState";
import { CARD_IDS, NODE_IDS } from "../src/shared/types";

function initialRequest() {
  const state = structuredClone(sampleState);
  for (const id of CARD_IDS) state.nodes[id].content = { backstory: "", abilities: [] };
  state.nodes.overview.content.summary = "";
  return { mode: "initial" as const, state };
}

it.skipIf(import.meta.env.VITE_RUN_OLLAMA_TEST !== "1")(
  "initial: generate three heroes and an overview from empty content",
  async () => {
    const request = initialRequest();
    const before = structuredClone(request.state);
    const result = await generateContent(request);
    if (!result.ok) throw new Error(result.error.code + ": " + result.error.message);
    expect(Object.keys(result.nodes).sort()).toEqual([...NODE_IDS].sort());
    for (const id of CARD_IDS) {
      const hero = result.nodes[id]?.content;
      expect(hero?.backstory).toMatch(/\S/);
      expect(hero?.abilities.length).toBeGreaterThan(0);
      for (const ability of hero?.abilities ?? []) expect(ability).toMatch(/\S/);
    }
    expect(result.nodes.overview?.content.summary).toMatch(/\S/);
    expect(request.state).toEqual(before);
    console.log("Initial party:", JSON.stringify(result.nodes, null, 2));
  },
  130_000,
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function envelope(content: string) {
  return Response.json({ message: { content } });
}

it("returns invalid JSON without consuming a second response", async () => {
  const nodes = Object.fromEntries(NODE_IDS.map(id => [id, { content: sampleState.nodes[id].content }]));
  const send = mockFetch()
    .mockResolvedValueOnce(envelope("{"))
    .mockResolvedValueOnce(envelope(JSON.stringify({ nodes })));
  expect(await generateContent(initialRequest())).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
  expect(send).toHaveBeenCalledTimes(1);
});

it("returns INVALID_JSON after one malformed response", async () => {
  const send = mockFetch().mockImplementation(async () => envelope("{"));
  expect(await generateContent(initialRequest())).toMatchObject({ ok: false, error: { code: "INVALID_JSON" } });
  expect(send).toHaveBeenCalledTimes(1);
});

it("returns TIMEOUT after the request reaches its deadline", async () => {
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => AbortSignal.abort(new DOMException("Deadline reached", "TimeoutError")));
  const send = mockFetch().mockImplementation(async (_url, options) => {
    options?.signal?.throwIfAborted();
    throw new Error("Expected the client to forward the timeout signal");
  });
  expect(await generateContent(initialRequest())).toMatchObject({ ok: false, error: { code: "TIMEOUT" } });
  expect(send).toHaveBeenCalledTimes(1);
});

it("returns MODEL_ERROR after one HTTP failure", async () => {
  const send = mockFetch().mockImplementation(async () => new Response(null, { status: 503 }));
  expect(await generateContent(initialRequest())).toMatchObject({ ok: false, error: { code: "MODEL_ERROR" } });
  expect(send).toHaveBeenCalledTimes(1);
});

it("forwards caller cancellation to the Ollama request", async () => {
  const controller = new AbortController();
  const send = mockFetch().mockImplementation(async (_url, options) => {
    const signal = options?.signal;
    if (!signal) throw new Error("Missing signal");
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
    signal.throwIfAborted();
    throw new Error("Cancellation was ignored");
  });
  await expect(generateContent(initialRequest(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(send).toHaveBeenCalledTimes(1);
});
