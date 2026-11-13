import { useEffect, useMemo, useRef, useState } from "react";
import { applyEdit, canUndo, regenerateAll, undo } from "../backend/fakeApi";
import { applyParam } from "../shared/applyParam";
import { affectedSet, explainAffected } from "../shared/dependencies";
import { withDerived } from "../shared/derived";
import { changedFieldsOf } from "../shared/diff";
import { questFor } from "../shared/quests";
import { sampleState } from "../shared/sampleState";
import {
  CARD_IDS,
  type CardNode,
  type Edit,
  type ErrorCode,
  type NodeId,
  type OverviewNode,
  type State,
} from "../shared/types";
import { CharacterCard } from "./components/CharacterCard";
import { OverviewCard } from "./components/OverviewCard";
import { HeroRoster } from "./components/HeroRoster";
import { QuestPanel } from "./components/QuestPanel";
import { Scenery } from "./components/Scenery";
import {
  getCondition,
  getParticipantId,
  getTaskId,
  HIGHLIGHT_CHANGES_IN_BASELINE,
} from "./condition";
import { logEvent, setSession } from "./logger";

const ERROR_TEXT: Record<ErrorCode, string> = {
  MODEL_ERROR: "Couldn’t reach the model.",
  TIMEOUT: "The model took too long to answer.",
  INVALID_JSON: "The model’s answer was malformed.",
  SCHEMA_MISMATCH: "The model’s answer was malformed.",
  OFF_SCOPE_ID: "The model tried to change something outside the affected parts.",
  PARAM_MISMATCH: "The model’s answer didn’t match your settings.",
  OUT_OF_RANGE: "The model’s answer had an out-of-range value.",
  INVALID_EDIT: "That change isn’t allowed (a hero can appear only once in the party).",
};

function labelOf(state: State, id: NodeId): string {
  return id === "overview" ? "the overview" : state.nodes[id].derived.name;
}

const PARAM_LABEL: Record<Edit["param"], string> = {
  cls: "hero",
  power: "power",
  temperament: "temperament",
  gear: "gear",
};

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface LastChange {
  before: State;
  after: State;
}

export function App() {
  const condition = useMemo(getCondition, []);
  const bounded = condition === "bounded";
  const showChanges = bounded || HIGHLIGHT_CHANGES_IN_BASELINE;

  // The quest comes from the session (participant and task), so the same session always gets the same one.
  const [committed, setCommitted] = useState<State>(() =>
    withDerived({ ...sampleState, quest: questFor(getParticipantId(), getTaskId()) }),
  );
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState<Edit | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);

  const started = useRef(false);
  useEffect(() => {
    setSession({ participantId: getParticipantId(), condition, taskId: getTaskId() });
    if (!started.current) {
      started.current = true;
      logEvent({ type: "task_start" });
    }
  }, [condition]);

  function finishTask() {
    logEvent({ type: "task_end" });
    setFinished(true);
  }

  // Draft = committed + the pending param, with derived values recomputed in code (no model call).
  const draft = useMemo(
    () => (pending ? withDerived(applyParam(committed, pending)) : committed),
    [committed, pending],
  );
  const affected = useMemo<NodeId[]>(() => (pending ? affectedSet(pending) : []), [pending]);
  // What the UI shows as scope. Only the bounded condition previews it.
  const scope = bounded ? affected : [];

  function handleEdit(edit: Edit) {
    setError(null);
    setNotice(null);
    setLastChange(null);
    const current = committed.nodes[edit.cardId].params[edit.param];
    // Moving a control back to its committed value cancels the pending edit.
    if (edit.value === current) {
      setPending(null);
      return;
    }
    setPending(edit);
    logEvent({
      type: "param_preview",
      cardId: edit.cardId,
      param: edit.param,
      from: current,
      to: edit.value,
      previewedAffected: bounded ? affectedSet(edit) : [],
    });
  }

  function cancel() {
    setError(null);
    setPending(null);
  }

  async function apply() {
    if (!pending) return;
    setError(null);
    setNotice(null);
    setUpdating(true);
    logEvent({ type: "apply_click", edit: pending });
    const run = bounded ? applyEdit : regenerateAll;
    const result = await run(committed, pending);
    setUpdating(false);

    if (result.ok) {
      logEvent({
        type: "apply_result",
        ok: true,
        latencyMs: result.latencyMs,
        affected: result.affected,
        changed: result.changed,
        offScope: result.changed.filter((id) => !result.affected.includes(id)),
      });
      setLastChange({ before: committed, after: result.state });
      setCommitted(result.state);
      setPending(null);
      setNotice(
        bounded
          ? result.changed.length > 0
            ? `Updated ${listNames(result.changed.map((id) => labelOf(result.state, id)))}.`
            : "Nothing changed."
          : "Party updated.",
      );
    } else {
      logEvent({
        type: "apply_result",
        ok: false,
        latencyMs: result.latencyMs,
        affected: affectedSet(pending),
        changed: [],
        offScope: [],
        errorCode: result.error.code,
      });
      // State is unchanged by contract. Keep the pending edit so the user can retry or cancel.
      setError(`${ERROR_TEXT[result.error.code]} Nothing was changed.`);
    }
  }

  function undoLast() {
    logEvent({ type: "undo_click" });
    const previous = undo();
    if (previous) setCommitted(previous);
    setError(null);
    setNotice(null);
    setLastChange(null);
  }

  // Every history change coincides with a state change, so reading it during render is fresh.
  const undoable = canUndo();

  // Why each node is (or is not) in the closure, shown on the cards. Bounded only.
  const whyById = useMemo(
    () => (pending && bounded ? new Map(explainAffected(pending).map((e) => [e.id, e.why])) : null),
    [pending, bounded],
  );
  const reasonFor = (id: NodeId): string | null => {
    if (!pending) return null;
    if (!bounded) return "The whole party is regenerated, so anything here may change.";
    const why = whyById?.get(id);
    if (!why) return "Doesn’t depend on this edit.";
    return why.kind === "edited"
      ? "This is the card you are editing."
      : `Reads ${labelOf(committed, why.from)}, which is changing.`;
  };
  // Baseline: no per-card scope, so every card is honestly marked as possibly changing.
  const maybeFor = () => pending !== null && !bounded && !updating;

  const summary = pending
    ? bounded
      ? `Changing ${labelOf(committed, pending.cardId)}’s ${PARAM_LABEL[pending.param]} will update ${listNames(
          affected.map((id) => labelOf(committed, id)),
        )}.`
      : "Applying regenerates the whole party, so any part may change."
    : (notice ?? "Adjust a control, then press Apply.");

  const fieldsFor = (id: NodeId): readonly string[] =>
    showChanges && lastChange ? changedFieldsOf(lastChange.before, lastChange.after, id) : [];
  const previousOf = (id: NodeId): State["nodes"][NodeId] | null =>
    showChanges && lastChange ? lastChange.before.nodes[id] : null;
  // Bounded: only the closure is being regenerated. Baseline: everything is.
  const updatingFor = (id: NodeId) => updating && (bounded ? affected.includes(id) : true);

  return (
    <>
      <Scenery />
      <main className="page">
      <header className="page__header">
        <h1>Character builder</h1>
        <p className="muted">Adjust a character, then press Apply.</p>
      </header>

      <section
        className={error ? "bar bar--error" : "bar"}
        role={error ? "alert" : undefined}
        aria-live={error ? "assertive" : "polite"}
      >
        <p className="bar__text">
          {error ?? summary}
          {error && " Try Apply again, or Cancel."}
        </p>
        <div className="bar__actions">
          <button
            type="button"
            className="btn"
            onClick={undoLast}
            disabled={!undoable || pending !== null || updating || finished}
          >
            Undo
          </button>
          <button type="button" className="btn" onClick={cancel} disabled={!pending || updating}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={apply}
            disabled={!pending || updating}
          >
            {updating ? "Applying…" : error ? "Retry" : "Apply"}
          </button>
        </div>
      </section>

      <QuestPanel
        quest={committed.quest}
        requirements={draft.nodes.overview.derived.requirements}
        finished={finished}
        busy={pending !== null || updating}
        onFinish={finishTask}
      />

      <HeroRoster party={CARD_IDS.map((id) => ({ id, cls: draft.nodes[id].params.cls }))} />

      <section className="grid">
        {CARD_IDS.map((id) => {
          const isPendingCard = pending?.cardId === id;
          return (
            <CharacterCard
              key={id}
              id={id}
              node={draft.nodes[id]}
              saved={committed.nodes[id]}
              affected={scope.includes(id)}
              staysAsIs={pending !== null && bounded && !affected.includes(id)}
              updating={updatingFor(id)}
              changedFields={fieldsFor(id)}
              reason={reasonFor(id)}
              maybe={maybeFor()}
              previous={previousOf(id) as CardNode | null}
              takenClasses={
                new Set(CARD_IDS.filter((o) => o !== id).map((o) => draft.nodes[o].params.cls))
              }
              locked={(param) =>
                finished ||
                updating ||
                (pending !== null && !(isPendingCard && pending.param === param))
              }
              onEdit={handleEdit}
            />
          );
        })}
      </section>

      <OverviewCard
        node={draft.nodes.overview}
        saved={committed.nodes.overview}
        cards={CARD_IDS.map((id) => draft.nodes[id])}
        affected={scope.includes("overview")}
        updating={updatingFor("overview")}
        changedFields={fieldsFor("overview")}
        reason={reasonFor("overview")}
        maybe={maybeFor()}
        previous={previousOf("overview") as OverviewNode | null}
      />

      <footer className="credits">
        AI-generated portraits by{" "}
        <a
          href="https://warheaddnc.itch.io/385-fantasy-portraits"
          target="_blank"
          rel="noreferrer noopener"
        >
          WarheadDnC
        </a>
        .
      </footer>
      </main>
    </>
  );
}
