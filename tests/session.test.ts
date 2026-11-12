import { describe, expect, it } from "vitest";
import { conditionOrderFor, sessionSearch } from "../src/shared/session";

describe("conditionOrderFor", () => {
  it("alternates by participant number so the order is balanced", () => {
    expect(conditionOrderFor("P01")).toEqual(["bounded", "baseline"]);
    expect(conditionOrderFor("P02")).toEqual(["baseline", "bounded"]);
    expect(conditionOrderFor("P03")[0]).toBe("bounded");
    expect(conditionOrderFor("P10")[0]).toBe("baseline");
  });

  it("gives each participant both conditions, once each", () => {
    for (const id of ["P01", "P02", "alice", "x"]) {
      expect([...conditionOrderFor(id)].sort()).toEqual(["baseline", "bounded"]);
    }
  });

  it("is stable for an id with no number", () => {
    expect(conditionOrderFor("alice")).toEqual(conditionOrderFor("alice"));
  });

  it("balances 10 participants 5 and 5", () => {
    const first = Array.from({ length: 10 }, (_, i) => conditionOrderFor(`P${String(i + 1).padStart(2, "0")}`)[0]);
    expect(first.filter((c) => c === "bounded")).toHaveLength(5);
  });
});

describe("sessionSearch", () => {
  it("builds the query string the page reads back", () => {
    const search = sessionSearch({ participant: "P01", condition: "baseline", task: "t2" });
    const p = new URLSearchParams(search);
    expect(p.get("participant")).toBe("P01");
    expect(p.get("condition")).toBe("baseline");
    expect(p.get("task")).toBe("t2");
  });

  it("escapes unusual ids", () => {
    const p = new URLSearchParams(sessionSearch({ participant: "a b&c", condition: "bounded", task: "t1" }));
    expect(p.get("participant")).toBe("a b&c");
  });
});
