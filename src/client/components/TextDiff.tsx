import { diffTokens, diffWords } from "../../shared/textDiff";

/** Inline word diff: removed words struck through in red, new words underlined in green. */
export function TextDiff({ before, after, show }: { before: string; after: string; show: boolean }) {
  if (!show || before === after) return <>{after}</>;
  return (
    <>
      {diffWords(before, after).map((p, i) =>
        p.kind === "same" ? (
          <span key={i}>{p.value}</span>
        ) : p.kind === "del" ? (
          <del key={i} className="diff__del">
            {p.value}
          </del>
        ) : (
          <ins key={i} className="diff__add">
            {p.value}
          </ins>
        ),
      )}
    </>
  );
}

/** The ability chips, with removed chips struck through and new chips marked. */
export function ChipsDiff({
  before,
  after,
  show,
  className,
}: {
  before: string[];
  after: string[];
  show: boolean;
  className?: string;
}) {
  const parts = show
    ? diffTokens(before, after)
    : after.map((value) => ({ kind: "same" as const, value }));
  return (
    <ul className={className}>
      {parts.map((p) => (
        <li
          key={`${p.kind}-${p.value}`}
          className={p.kind === "add" ? "chip--add" : p.kind === "del" ? "chip--del" : undefined}
        >
          {p.kind === "del" ? <del>{p.value}</del> : p.value}
        </li>
      ))}
    </ul>
  );
}
