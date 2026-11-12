// STUB logger. The study role owns the real one (persistence to a JSON-lines file, analysis).
// Keep these two signatures: the UI already calls them. See contracts.md section 3.

import type { LogEvent, LogEventBody, LogSession } from "../shared/types";

let session: LogSession = { participantId: "dev", condition: "bounded", taskId: "dev" };
const events: LogEvent[] = [];

/** Called once per task so events need not repeat these fields. */
export function setSession(s: LogSession): void {
  session = s;
}

/** Stamps the session fields and a timestamp (ms since epoch), then records the event. */
export function logEvent(body: LogEventBody): void {
  events.push({ ...session, timestamp: Date.now(), ...body } as LogEvent);
}

/** Stub only: in-memory log, for development and tests. */
export function getLog(): readonly LogEvent[] {
  return events;
}

export function clearLog(): void {
  events.length = 0;
}
