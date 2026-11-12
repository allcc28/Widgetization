import type { CardNode, OverviewNode } from "../../shared/types";
import { useCardPresence } from "../useCardPresence";
import { useEffect, useState } from "react";
import { FromTo } from "./FromTo";
import { TextDiff } from "./TextDiff";
import { RulesPanel } from "./RulesPanel";

const cx = (...parts: (string | false)[]) => parts.filter(Boolean).join(" ");

interface Props {
  /** Draft values (the evaluation reflects the pending edit). */
  node: OverviewNode;
  /** The committed overview, used to show "from -> to" while an edit is pending. */
  saved: OverviewNode;
  /** The three cards as currently shown, for the scoring explanation. */
  cards: CardNode[];
  /** In the previewed dependency closure (bounded condition only). */
  affected: boolean;
  /** This card is being regenerated right now. */
  updating: boolean;
  /** Fields that changed in the last successful Apply; empty when not highlighting. */
  changedFields: readonly string[];
  /** The overview before the last successful Apply; null when not highlighting changes. */
  previous: OverviewNode | null;
  /** Why this card is or is not in the closure (shown while an edit is pending). */
  reason: string | null;
  /** Baseline with a pending edit: the whole party may change. */
  maybe: boolean;
}

export function OverviewCard({ node, saved, cards, affected, updating, changedFields, previous, reason, maybe }: Props) {
  const presence = useCardPresence("overview");
  const d = node.derived;
  const s = saved.derived;
  const has = (field: string) => changedFields.includes(field);
  const justChanged = changedFields.length > 0;
  const [showDiff, setShowDiff] = useState(true);
  useEffect(() => setShowDiff(true), [previous]);

  return (
    <article
      className={cx(
        "card",
        "card--overview",
        affected && "card--affected",
        justChanged && "card--changed",
      )}
      data-slot="overview"
      aria-busy={updating}
      {...presence}
    >
      <span
        className={cx("gem", "gem--lg", has("totalPower") && "gem--changed")}
        role="img"
        aria-label={`Party power ${d.totalPower}`}
      >
        {d.totalPower}
      </span>
      <div className="overview__body">
        <header className="card__header">
          <h2 className="card__name">Party overview</h2>
          <p className="card__class">
            Total power <FromTo from={s.totalPower} to={d.totalPower} /> · Attack{" "}
            <span className={cx(has("totalAttack") && "changed")}>
              <FromTo from={s.totalAttack} to={d.totalAttack} />
            </span>{" "}
            · Defense{" "}
            <span className={cx(has("totalDefense") && "changed")}>
              <FromTo from={s.totalDefense} to={d.totalDefense} />
            </span>
          </p>
        </header>

        {reason && <p className="why">{reason}</p>}

        <p className="rating-line">
          Rating{" "}
          <span className={cx("rating", has("rating") && "changed")}>
            <FromTo from={s.rating} to={d.rating} />
          </span>
        </p>
        <ul className={cx("findings", has("findings") && "changed")}>
          {d.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <p className="card__backstory">
          <TextDiff
            before={previous?.content.summary ?? node.content.summary}
            after={node.content.summary}
            show={showDiff}
          />
        </p>
        {has("summary") && (
          <button type="button" className="linkbtn" onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? "Hide changes" : "Show changes"}
          </button>
        )}

        <RulesPanel cards={cards} />
      </div>
      {updating ? (
        <span className="tag tag--hot tag--corner">Updating…</span>
      ) : affected ? (
        <span className="tag tag--hot tag--corner">Will change</span>
      ) : maybe ? (
        <span className="tag tag--maybe tag--corner">May change</span>
      ) : justChanged ? (
        <span className="tag tag--changed tag--corner">Changed</span>
      ) : previous !== null ? (
        <span className="tag tag--corner">Unchanged</span>
      ) : null}
    </article>
  );
}
