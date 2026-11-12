import { beforeEach, describe, expect, it } from "vitest";
import { clearLog, getLog, logEvent, setSession } from "../src/client/logger";

beforeEach(() => clearLog());

describe("stub logger", () => {
  it("stamps session fields and a timestamp on every event", () => {
    setSession({ participantId: "P01", condition: "baseline", taskId: "t2" });
    logEvent({ type: "undo_click" });
    const [e] = getLog();
    expect(e).toMatchObject({
      participantId: "P01",
      condition: "baseline",
      taskId: "t2",
      type: "undo_click",
    });
    expect(typeof e?.timestamp).toBe("number");
  });
});
