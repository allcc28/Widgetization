import type { Condition } from "../shared/types";

/**
 * Study session settings come from the page URL so a session can be launched with one link:
 *   ?condition=baseline&participant=P01&task=t1
 * Defaults: bounded, "dev", "dev".
 */
function params(): URLSearchParams {
  return new URLSearchParams(typeof location === "undefined" ? "" : location.search);
}

/** The researcher panel is shown instead of the task page when the URL has `?admin`. */
export function isAdmin(): boolean {
  return params().has("admin");
}

export function getCondition(): Condition {
  return params().get("condition") === "baseline" ? "baseline" : "bounded";
}

export function getParticipantId(): string {
  return params().get("participant") ?? "dev";
}

export function getTaskId(): string {
  return params().get("task") ?? "dev";
}

/**
 * Whether the baseline condition also highlights what changed after Apply.
 * Currently true: both conditions highlight, so the comparison isolates scope preview plus the
 * code-enforced guarantee. Set to false to hide highlights in the baseline (the original core
 * design). Change it only with the team, and before the pilot, not during the study.
 */
export const HIGHLIGHT_CHANGES_IN_BASELINE = true;
