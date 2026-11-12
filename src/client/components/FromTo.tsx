/** Shows `to`, or `from → to` with the old value struck through when they differ. */
export function FromTo({ from, to }: { from: string | number; to: string | number }) {
  if (from === to) return <>{to}</>;
  return (
    <>
      <span className="control__from">{from}</span> → {to}
    </>
  );
}
