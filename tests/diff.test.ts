import { cardDerived } from "../src/shared/derived";
import { describe, expect, it } from "vitest";
import { changedFieldsOf, diff } from "../src/shared/diff";
import { sampleState } from "../src/shared/sampleState";
import type { State } from "../src/shared/types";

describe("changedFieldsOf", () => {
  it("reports a gear change with its derived stats", () => {
    const after = structuredClone(sampleState);
    after.nodes.card_1.params.gear = "fine";
    after.nodes.card_1.derived = cardDerived(after.nodes.card_1.params);
    expect(changedFieldsOf(sampleState, after, "card_1")).toEqual(["gear", "attack", "defense"]);
  });

  it("lists the fields that differ on a card", () => {
    const after: State = structuredClone(sampleState);
    after.nodes.card_2.params.power = 4;
    after.nodes.card_2.content.backstory = "changed";
    expect(changedFieldsOf(sampleState, after, "card_2")).toEqual(["power", "backstory"]);
    expect(changedFieldsOf(sampleState, after, "card_1")).toEqual([]);
  });

  it("lists the fields that differ on the overview", () => {
    const after: State = structuredClone(sampleState);
    after.nodes.overview.derived.totalPower = 1;
    after.nodes.overview.content.summary = "changed";
    expect(changedFieldsOf(sampleState, after, "overview")).toEqual(["totalPower", "summary"]);
  });
});

describe("diff", () => {
  it("returns [] for identical states", () => {
    expect(diff(sampleState, structuredClone(sampleState))).toEqual([]);
  });

  it("returns only the nodes that differ", () => {
    const after: State = structuredClone(sampleState);
    after.nodes.card_2.content.backstory = "changed";
    after.nodes.overview.content.summary = "changed too";
    expect(diff(sampleState, after)).toEqual(["card_2", "overview"]);
  });
});
