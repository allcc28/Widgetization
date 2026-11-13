import { HERO_NAME } from "../../shared/heroes";
import { ROLE_OF_CLASS } from "../../shared/derived";
import { CLASSES, ROLES, type CardId, type CharacterClass } from "../../shared/types";
import { CLASS_PORTRAITS } from "../portraits";

interface Props {
  /** The class in each slot of the party currently shown. */
  party: { id: CardId; cls: CharacterClass }[];
}

/** A read-only reference: every hero, grouped by role, with the ones already in the party marked. */
export function HeroRoster({ party }: Props) {
  const slotOf = (cls: CharacterClass) => {
    const i = party.findIndex((p) => p.cls === cls);
    return i === -1 ? null : i + 1;
  };
  return (
    <section className="roster" aria-labelledby="roster-title">
      <h2 id="roster-title" className="roster__title">
        Heroes
      </h2>
      <div className="roster__roles">
        {ROLES.map((role) => (
          <div key={role} className="roster__role">
            <h3 className="roster__rolename">{role}</h3>
            <ul className="roster__list">
              {CLASSES.filter((c) => ROLE_OF_CLASS[c] === role).map((cls) => {
                const slot = slotOf(cls);
                return (
                  <li key={cls} className={slot ? "rhero rhero--in" : "rhero"}>
                    <img src={CLASS_PORTRAITS[cls]} alt="" />
                    <span className="rhero__text">
                      <span className="rhero__name">{HERO_NAME[cls]}</span>
                      <span className="rhero__cls">{cls}</span>
                    </span>
                    {slot && <span className="rhero__slot">Slot {slot}</span>}
                    <span className="sr-only">
                      {slot ? ` (in the party, slot ${slot})` : " (not in the party)"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
