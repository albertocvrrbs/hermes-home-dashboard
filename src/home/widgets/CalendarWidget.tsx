import { useEffect, useState } from "react";
import { HoverArrows } from "./HoverArrows";

/** Month grid, today highlighted in the accent, weeks Monday-first. Hover
 *  arrows page through months (resets to the current month on reload). Picks a
 *  density tier from the widget's cell size: mini hides the weekday header. */
export function CalendarWidget({ gridSize }: { gridSize: { gw: number; gh: number } }) {
  const [now, setNow] = useState(() => new Date());
  const [offset, setOffset] = useState(0); // months from the current one
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first column index of day 1.
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayLetters = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1) // 2024-01-01 was a Monday
      .toLocaleDateString(undefined, { weekday: "narrow" }),
  );

  const tier = gridSize.gw <= 2 ? "mini" : gridSize.gw >= 4 ? "large" : "normal";

  return (
    <div className={`home-cal tier-${tier}`}>
      <HoverArrows
        onPrev={() => setOffset(offset - 1)}
        onNext={() => setOffset(offset + 1)}
        label={offset === 0 ? undefined : "today"}
        onLabelClick={offset === 0 ? undefined : () => setOffset(0)}
      />
      <div className="home-cal-month">{monthLabel}</div>
      <div className="home-cal-grid">
        {tier !== "mini" && dayLetters.map((l, i) => (
          <span className="home-cal-h" key={`h${i}`}>{l}</span>
        ))}
        {Array.from({ length: firstCol }, (_, i) => (
          <span key={`p${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span
            key={i + 1}
            className={isCurrentMonth && i + 1 === today ? "home-cal-today" : "home-cal-d"}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
