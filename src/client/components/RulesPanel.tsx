import {
  cardBreakdown,
  GEAR_MODS,
  POWER_GAP_LIMIT,
  RATING_THRESHOLDS,
  ROLE_MODS,
  TEMPERAMENT_MODS,
  WEAK_TANK_DEFENSE,
} from "../../shared/derived";
import { GEARS, ROLES, TEMPERAMENTS, type CardNode } from "../../shared/types";

/** "7 + 2 − 2 + 0 = 7" */
function expression(power: number, mods: number[], total: number): string {
  const term = (n: number) => `${n < 0 ? "−" : "+"} ${Math.abs(n)}`;
  return `${power} ${mods.map(term).join(" ")} = ${total}`;
}

/**
 * "How is this scored?" Every number comes from the same tables the calculation uses
 * (src/shared/derived.ts), so this explanation cannot drift from the real rules.
 */
export function RulesPanel({ cards }: { cards: CardNode[] }) {
  const lastTier = RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];

  return (
    <details className="rules">
      <summary>How is this scored?</summary>
      <div className="rules__body">
        <h3>Attack and defense</h3>
        <p>
          For each character, <strong>Attack</strong> = Power + role bonus + temperament modifier + gear modifier.{" "}
          <strong>Defense</strong> is built the same way. The minimum is 1. The role comes from the
          character’s class.
        </p>

        <div className="rules__tables">
          <table>
            <caption>Role bonus</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Attack</th>
                <th scope="col">Defense</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r}>
                  <th scope="row">{r}</th>
                  <td>{ROLE_MODS[r].atk}</td>
                  <td>{ROLE_MODS[r].def}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table>
            <caption>Temperament modifier</caption>
            <thead>
              <tr>
                <th scope="col">Temperament</th>
                <th scope="col">Attack</th>
                <th scope="col">Defense</th>
              </tr>
            </thead>
            <tbody>
              {TEMPERAMENTS.map((t) => (
                <tr key={t}>
                  <th scope="row">{t}</th>
                  <td>{TEMPERAMENT_MODS[t].atk}</td>
                  <td>{TEMPERAMENT_MODS[t].def}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table>
            <caption>Gear modifier</caption>
            <thead>
              <tr>
                <th scope="col">Gear</th>
                <th scope="col">Attack</th>
                <th scope="col">Defense</th>
              </tr>
            </thead>
            <tbody>
              {GEARS.map((g) => (
                <tr key={g}>
                  <th scope="row">{g}</th>
                  <td>{GEAR_MODS[g].atk}</td>
                  <td>{GEAR_MODS[g].def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Right now</h3>
        <ul className="rules__list">
          {cards.map((c) => {
            const b = cardBreakdown(c.params);
            return (
              <li key={c.derived.name}>
                <strong>{c.derived.name}</strong> ({b.role}, {c.params.temperament}, {c.params.gear} gear)
                <br />
                Attack {expression(b.power, [b.roleAtk, b.tempAtk, b.gearAtk], b.attack)}
                <br />
                Defense {expression(b.power, [b.roleDef, b.tempDef, b.gearDef], b.defense)}
              </li>
            );
          })}
        </ul>

        <h3>Party rating</h3>
        <p>
          Start from the average strength of the three characters, where a character’s strength is
          (Attack + Defense) ÷ 2:{" "}
          {RATING_THRESHOLDS.map((t) => `${t.min}+ is ${t.rating}`).join(", ")}, and below{" "}
          {lastTier?.min} is D. Then the rating drops one grade for each of these:
        </p>
        <ul>
          <li>a missing role (Tank, Damage or Support);</li>
          <li>a gap of more than {POWER_GAP_LIMIT} between the strongest and weakest Power (the slider value);</li>
          <li>each unmet requirement of the quest (listed in the quest panel).</li>
        </ul>
        <p>
          A tank whose Defense is below {WEAK_TANK_DEFENSE} is also pointed out, without a grade
          penalty. All of this is calculated by the app, not by the model.
        </p>
      </div>
    </details>
  );
}
