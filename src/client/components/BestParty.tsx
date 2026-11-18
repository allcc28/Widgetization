import { CARD_IDS, type State } from "../../shared/types";
import { partyKey } from "../bestParty";

interface Props {
  /** Best parties so far, newest first (see `bestParty.ts`). */
  entries: readonly State[];
  /** `partyKey` of the committed party, to mark which entry is the one on screen. */
  currentKey: string;
  /** Blocked while an edit is pending or being applied, or after the task is finished. */
  disabled: boolean;
  onRestore: (state: State) => void;
}

/** The highest-rated parties seen in this session, each restorable with one click. */
export function BestParty({ entries, currentKey, disabled, onRestore }: Props) {
  const first = entries[0];
  if (!first) return null;
  const top = first.nodes.overview.derived;
  const total = top.requirements.length;
  return (
    <section className="best" aria-labelledby="best-title">
      <div className="best__head">
        <h2 id="best-title" className="best__title">
          Best party so far
        </h2>
        <p className="best__hint">
          Rated {top.rating}
          {total > 0 && `, ${top.requirements.filter((r) => r.met).length} of ${total} requirements met`}
          . Restore brings back the heroes and their text; Undo takes you back again.
        </p>
      </div>
      <ul className="best__list">
        {entries.map((state) => {
          const key = partyKey(state);
          const current = key === currentKey;
          const names = CARD_IDS.map((id) => state.nodes[id].derived.name);
          return (
            <li key={key} className={current ? "bestp bestp--current" : "bestp"}>
              <span className="bestp__rating" aria-label={`Rating ${state.nodes.overview.derived.rating}`}>
                {state.nodes.overview.derived.rating}
              </span>
              <span className="bestp__names">{names.join(" · ")}</span>
              <span className="bestp__stats">
                Atk {state.nodes.overview.derived.totalAttack} · Def {state.nodes.overview.derived.totalDefense}
              </span>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => onRestore(state)}
                disabled={disabled || current}
                aria-label={current ? `${names.join(", ")}: this is the current party` : `Restore ${names.join(", ")}`}
              >
                {current ? "Current" : "Restore"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
