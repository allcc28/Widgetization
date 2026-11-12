import {
  CLASSES,
  GEARS,
  POWER_MAX,
  POWER_MIN,
  TEMPERAMENTS,
  type CardId,
  type CardNode,
  type CharacterClass,
  type Edit,
  type Gear,
  type Temperament,
} from "../../shared/types";
import { useEffect, useState, type CSSProperties } from "react";
import { useCardPresence } from "../useCardPresence";
import { FromTo } from "./FromTo";
import { HERO_NAME } from "../../shared/heroes";
import { CLASS_PORTRAITS } from "../portraits";
import { ChipsDiff, TextDiff } from "./TextDiff";

const cx = (...parts: (string | false)[]) => parts.filter(Boolean).join(" ");

interface Props {
  id: CardId;
  /** Draft values (what the controls show right now). */
  node: CardNode;
  /** The committed card, used to show "from -> to" while an edit is pending. */
  saved: CardNode;
  /** In the previewed dependency closure (bounded condition only). */
  affected: boolean;
  /** An edit is pending and this card is outside its closure (bounded condition only). */
  staysAsIs: boolean;
  /** This card is being regenerated right now. */
  updating: boolean;
  /** Fields that changed in the last successful Apply; empty when not highlighting. */
  changedFields: readonly string[];
  /** This card before the last successful Apply; null when not highlighting changes. */
  previous: CardNode | null;
  /** Why this card is or is not in the closure (shown while an edit is pending). */
  reason: string | null;
  /** Baseline with a pending edit: the whole party may change. */
  maybe: boolean;
  /** Classes already used by the other cards: a hero can appear once per party. */
  takenClasses: ReadonlySet<CharacterClass>;
  /** Whether a control is disabled (only the pending edit's own control stays live). */
  locked: (param: Edit["param"]) => boolean;
  onEdit: (edit: Edit) => void;
}

export function CharacterCard({
  id,
  node,
  saved,
  affected,
  staysAsIs,
  updating,
  changedFields,
  previous,
  reason,
  maybe,
  takenClasses,
  locked,
  onEdit,
}: Props) {
  const presence = useCardPresence(id);
  const { params, content, derived } = node;
  const has = (field: string) => changedFields.includes(field);
  const justChanged = changedFields.length > 0;
  const textChanged = has("backstory") || has("abilities");
  // Unchanged after an Apply: in bounded this is guaranteed by code, in baseline it is observed.
  const unchanged = previous !== null && !justChanged;
  const powerLimit = params.power <= POWER_MIN ? "min" : params.power >= POWER_MAX ? "max" : null;
  const powerPct = ((params.power - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 100;
  const [showDiff, setShowDiff] = useState(true);
  useEffect(() => setShowDiff(true), [previous]);

  return (
    <article
      className={cx(
        "card",
        affected && "card--affected",
        staysAsIs && "card--stays",
        justChanged && "card--changed",
      )}
      data-slot={id}
      aria-busy={updating}
      {...presence}
    >
      <div className="art">
        <span className={cx("gem", has("power") && "gem--changed")} role="img" aria-label={`Power ${params.power}`}>
          {params.power}
        </span>
        <img className="art__figure" src={CLASS_PORTRAITS[params.cls]} alt="" />
        {updating ? (
          <span className="tag tag--hot">Updating…</span>
        ) : affected ? (
          <span className="tag tag--hot">Will change</span>
        ) : maybe ? (
          <span className="tag tag--maybe">May change</span>
        ) : justChanged ? (
          <span className="tag tag--changed">Changed</span>
        ) : staysAsIs ? (
          <span className="tag">Stays as is</span>
        ) : unchanged ? (
          <span className="tag">Unchanged</span>
        ) : null}
      </div>

      <header className="card__header">
        <h2 className={cx("card__name", has("name") && "changed")}>{derived.name}</h2>
        <p className="card__class">
          {params.cls} · {derived.role}
        </p>
      </header>

      {reason && <p className="why">{reason}</p>}

      <dl className="stats">
        <div>
          <dt>Attack</dt>
          <dd className={cx(has("attack") && "changed")}>
            <FromTo from={saved.derived.attack} to={derived.attack} />
          </dd>
        </div>
        <div>
          <dt>Defense</dt>
          <dd className={cx(has("defense") && "changed")}>
            <FromTo from={saved.derived.defense} to={derived.defense} />
          </dd>
        </div>
      </dl>

      <div className="controls">
        <div className="control">
          <span className="control__label" id={`${id}-hero-label`}>
            Hero
          </span>
          <div className="heroes" role="radiogroup" aria-labelledby={`${id}-hero-label`}>
            {CLASSES.map((cls) => {
              const selected = params.cls === cls;
              const taken = takenClasses.has(cls) && !selected;
              return (
                <label
                  key={cls}
                  title={`${HERO_NAME[cls]} · ${cls}${taken ? " (in the party)" : ""}`}
                  className={cx("hero", selected && "hero--on", taken && "hero--taken")}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`${id}-hero`}
                    checked={selected}
                    disabled={locked("cls") || taken}
                    aria-label={`${HERO_NAME[cls]}, ${cls}${taken ? " (already in the party)" : ""}`}
                    onChange={() => onEdit({ cardId: id, param: "cls", value: cls })}
                  />
                  <img src={CLASS_PORTRAITS[cls]} alt="" />
                </label>
              );
            })}
          </div>
          {params.cls !== saved.params.cls && (
            <span className={cx("control__value", has("cls") && "changed")}>
              <span className="control__from">
                {saved.derived.name} · {saved.params.cls}
              </span>{" "}
              →
            </span>
          )}
        </div>

        <div className="control">
          <label htmlFor={`${id}-power`}>Power</label>
          <div className="control__row">
            <input
              id={`${id}-power`}
              className={cx("slider", powerLimit !== null && "slider--limit")}
              style={{ "--pct": `${powerPct}%` } as CSSProperties}
              type="range"
              min={POWER_MIN}
              max={POWER_MAX}
              step={1}
              value={params.power}
              disabled={locked("power")}
              onChange={(e) => onEdit({ cardId: id, param: "power", value: Number(e.target.value) })}
            />
            <output htmlFor={`${id}-power`} className={cx("control__value", has("power") && "changed")}>
              <FromTo from={saved.params.power} to={params.power} />
            </output>
            {powerLimit && <span className="limit">{powerLimit}</span>}
          </div>
        </div>

        <div className="control">
          <label htmlFor={`${id}-temperament`}>Temperament</label>
          <div className="control__row">
            <select
              id={`${id}-temperament`}
              className={cx(has("temperament") && "changed")}
              value={params.temperament}
              disabled={locked("temperament")}
              onChange={(e) =>
                onEdit({ cardId: id, param: "temperament", value: e.target.value as Temperament })
              }
            >
              {TEMPERAMENTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {params.temperament !== saved.params.temperament && (
              <span className="control__value">
                <span className="control__from">{saved.params.temperament}</span> →
              </span>
            )}
          </div>
        </div>

        <div className="control">
          <span className="control__label" id={`${id}-gear-label`}>
            Gear
          </span>
          <div className="control__row">
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-gear-label`}>
              {GEARS.map((g) => (
                <label
                  key={g}
                  className={cx("segmented__opt", params.gear === g && "segmented__opt--on")}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`${id}-gear`}
                    checked={params.gear === g}
                    disabled={locked("gear")}
                    onChange={() => onEdit({ cardId: id, param: "gear", value: g as Gear })}
                  />
                  {g}
                </label>
              ))}
            </div>
            {params.gear !== saved.params.gear && (
              <span className={cx("control__value", has("gear") && "changed")}>
                <span className="control__from">{saved.params.gear}</span> →
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="card__backstory">
        <TextDiff
          before={previous?.content.backstory ?? content.backstory}
          after={content.backstory}
          show={showDiff}
        />
      </p>
      <ChipsDiff
        className="chips"
        before={previous?.content.abilities ?? content.abilities}
        after={content.abilities}
        show={showDiff}
      />
      {textChanged && (
        <button type="button" className="linkbtn" onClick={() => setShowDiff((v) => !v)}>
          {showDiff ? "Hide changes" : "Show changes"}
        </button>
      )}
    </article>
  );
}
