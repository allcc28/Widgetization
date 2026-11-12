// Decorative night scene behind the page: red crescent moon, lightning, bats, a dead branch, a castle, mist and
// rising embers. Pure CSS and inline SVG (see styles.css), hidden from assistive tech.

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 8) % 100}%`,
  delay: `${-((i * 5) % 17)}s`,
  duration: `${14 + ((i * 3) % 9)}s`,
  size: 2 + (i % 3),
}));

export function Scenery() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="sky__moon" />
      <div className="sky__flash" />
      <div className="sky__bolt sky__bolt--1" />
      <div className="sky__bolt sky__bolt--2" />
      <div className="sky__branch" />
      <div className="sky__bats" />
      <div className="sky__castle" />
      <div className="sky__mist" />
      <div className="sky__mist sky__mist--2" />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="sky__ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDelay: e.delay,
            animationDuration: e.duration,
          }}
        />
      ))}
    </div>
  );
}
