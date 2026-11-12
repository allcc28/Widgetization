import { useMemo, useState } from "react";
import { describeRequirement } from "../shared/derived";
import { questFor } from "../shared/quests";
import { conditionOrderFor, sessionSearch, TASK_IDS } from "../shared/session";
import type { Condition } from "../shared/types";
import { Scenery } from "./components/Scenery";

const CONDITIONS: Condition[] = ["bounded", "baseline"];

/**
 * Researcher panel (open with `?admin`). Sets up a session without hand-editing the URL, shows
 * which quest a participant gets, and suggests a balanced condition order. Participants never
 * see it: the task page has no link to it and no way to change the condition.
 */
export function AdminPanel() {
  const [participant, setParticipant] = useState("P01");
  const [condition, setCondition] = useState<Condition>("bounded");
  const [task, setTask] = useState<string>("t1");
  const [copied, setCopied] = useState<string | null>(null);

  const id = participant.trim();
  const order = useMemo(() => conditionOrderFor(id), [id]);
  const suggested = TASK_IDS.map((t, i) => ({ task: t, condition: order[i] as Condition }));

  const link = (s: { condition: Condition; task: string }) =>
    `${location.origin}${location.pathname}${sessionSearch({ participant: id, ...s })}`;

  function start(s: { condition: Condition; task: string }) {
    location.href = link(s);
  }

  async function copy(s: { condition: Condition; task: string }, key: string) {
    try {
      await navigator.clipboard.writeText(link(s));
      setCopied(key);
    } catch {
      setCopied("blocked");
    }
  }

  const quest = id ? questFor(id, task) : null;

  return (
    <>
      <Scenery />
      <main className="page admin">
        <header className="page__header">
          <h1>Researcher panel</h1>
          <p className="muted">Set up a session. Participants never see this page.</p>
        </header>

        <section className="quest admin__block">
          <label className="admin__field">
            <span className="quest__kicker">Participant id</span>
            <input
              className="admin__input"
              value={participant}
              onChange={(e) => {
                setParticipant(e.target.value);
                setCopied(null);
              }}
              placeholder="P01"
              spellCheck={false}
            />
          </label>
          <p className="quest__status">
            The id decides the quest pair and the suggested condition order, so use the same id for
            both of a participant’s sessions.
          </p>
        </section>

        <section className="quest admin__block" aria-labelledby="suggested">
          <h2 id="suggested" className="quest__title">
            Suggested sessions
          </h2>
          <p className="quest__status">
            Odd participant numbers start with bounded, even numbers with baseline, to balance the order.
          </p>
          {suggested.map((s, i) => {
            const q = id ? questFor(id, s.task) : null;
            const key = `s${i}`;
            return (
              <div key={s.task} className="admin__row">
                <div>
                  <p className="quest__kicker">
                    Session {i + 1} · {s.condition} · {s.task}
                  </p>
                  <p className="admin__quest">{q ? q.title : "Enter a participant id"}</p>
                </div>
                <div className="admin__actions">
                  <button type="button" className="btn btn--primary" disabled={!id} onClick={() => start(s)}>
                    Start
                  </button>
                  <button type="button" className="btn" disabled={!id} onClick={() => copy(s, key)}>
                    {copied === key ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="quest admin__block" aria-labelledby="custom">
          <h2 id="custom" className="quest__title">
            Custom session
          </h2>
          <div className="admin__grid">
            <label className="admin__field">
              <span className="quest__kicker">Condition</span>
              <select
                className="admin__input"
                value={condition}
                onChange={(e) => setCondition(e.target.value as Condition)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin__field">
              <span className="quest__kicker">Task</span>
              <select className="admin__input" value={task} onChange={(e) => setTask(e.target.value)}>
                {TASK_IDS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {quest && (
            <div>
              <p className="admin__quest">{quest.title}</p>
              <p className="quest__brief">{quest.brief}</p>
              <ul className="quest__reqs">
                {quest.requirements.map((r) => (
                  <li key={describeRequirement(r)} className="req">
                    {describeRequirement(r)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="admin__actions">
            <button type="button" className="btn btn--primary" disabled={!id} onClick={() => start({ condition, task })}>
              Start
            </button>
            <button type="button" className="btn" disabled={!id} onClick={() => copy({ condition, task }, "custom")}>
              {copied === "custom" ? "Copied" : "Copy link"}
            </button>
          </div>
          {copied === "blocked" && (
            <p className="quest__status" role="status">
              The browser blocked copying. Use Start, then copy the address bar.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
