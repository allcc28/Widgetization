import type { OverviewNode, Quest } from "../../shared/types";

interface Props {
  quest: Quest;
  /** The requirements as checked against the party currently shown (they update live). */
  requirements: OverviewNode["derived"]["requirements"];
  finished: boolean;
  /** Blocked while an edit is pending or being applied. */
  busy: boolean;
  onFinish: () => void;
}

/** The task: a background, what the party must satisfy, and a button to end the task. */
export function QuestPanel({ quest, requirements, finished, busy, onFinish }: Props) {
  const allMet = requirements.length > 0 && requirements.every((r) => r.met);
  return (
    <section className="quest" aria-labelledby="quest-title">
      <div className="quest__main">
        <p className="quest__kicker">Quest</p>
        <h2 id="quest-title" className="quest__title">
          {quest.title}
        </h2>
        <p className="quest__brief">{quest.brief}</p>
      </div>

      {requirements.length > 0 && (
        <ul className="quest__reqs" aria-label="Requirements">
          {requirements.map((r) => (
            <li key={r.text} className={r.met ? "req req--met" : "req req--unmet"}>
              <span aria-hidden="true">{r.met ? "✔" : "✗"}</span> {r.text}
              <span className="sr-only">{r.met ? " (met)" : " (not met)"}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="quest__foot">
        <p className="quest__status" aria-live="polite">
          {finished
            ? "Task finished."
            : allMet
              ? "All requirements are met. Finish when you are happy with the party."
              : requirements.length > 0
                ? "Choose heroes and adjust them until every requirement is met."
                : "No requirements. Tune the party however you like."}
        </p>
        <button type="button" className="btn" onClick={onFinish} disabled={finished || busy}>
          Finish task
        </button>
      </div>
    </section>
  );
}
