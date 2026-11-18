import { useLayoutEffect, useState, type RefObject } from "react";
import type { CardId } from "../../shared/types";

interface Props {
  /** The element the overlay is positioned in (the page). Must be `position: relative`. */
  container: RefObject<HTMLElement | null>;
  /** The edited card; null hides the link. */
  from: CardId | null;
  /** Dashed while the edit is previewed, solid once it has been applied. */
  phase: "preview" | "done";
  /** Short text beside the line, e.g. "reads Brann". */
  label: string;
}

interface Geometry {
  x: number;
  top: number;
  bottom: number;
}

/**
 * A line from the edited card down into the party overview: the one edge of the dependency
 * graph the player can see. Decorative; the cards carry the same reason as text.
 */
export function ScopeLink({ container, from, phase, label }: Props) {
  const [geo, setGeo] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    const a = root?.querySelector(`[data-slot="${from}"]`);
    const b = root?.querySelector('[data-slot="overview"]');
    if (!root || !from || !(a instanceof HTMLElement) || !(b instanceof HTMLElement)) {
      setGeo(null);
      return;
    }
    const measure = () => {
      const r = root.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      setGeo({ x: ra.left + ra.width / 2 - r.left, top: ra.bottom - r.top, bottom: rb.top - r.top });
    };
    measure();
    // Cards change height while a diff is shown; the page reflows on resize.
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(a);
    ro.observe(b);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [container, from, phase]);

  if (!geo || !from) return null;

  // Reach a little into both cards' padding so the line is longer than the gap between them.
  const REACH = 12;
  const y1 = geo.top - REACH;
  const y2 = geo.bottom + REACH;
  const mid = (geo.top + geo.bottom) / 2;

  return (
    <div className={`links links--${phase}`} aria-hidden="true">
      <svg>
        <defs>
          <marker id="links-head" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path className="links__head" d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>
        <line className="links__line" x1={geo.x} y1={y1} x2={geo.x} y2={y2} markerEnd="url(#links-head)" />
        <circle className="links__dot" cx={geo.x} cy={y1} r="4" />
      </svg>
      <span className="links__label" style={{ left: geo.x + 12, top: mid }}>
        {label}
      </span>
    </div>
  );
}
