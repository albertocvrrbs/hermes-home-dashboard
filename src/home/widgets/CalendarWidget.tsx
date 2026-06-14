import { useEffect, useState } from "react";

/** Current month as a mono grid, today highlighted in the accent.
 *  Weeks start on Monday. Pure render — no data, no config. */
export function CalendarWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first column index of day 1.
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayLetters = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1) // 2024-01-01 was a Monday
      .toLocaleDateString(undefined, { weekday: "narrow" }),
  );

  return (
    <div className="home-cal">
      <div className="home-cal-month">{monthLabel}</div>
      <div className="home-cal-grid">
        {dayLetters.map((l, i) => (
          <span className="home-cal-h" key={`h${i}`}>{l}</span>
        ))}
        {Array.from({ length: firstCol }, (_, i) => (
          <span key={`p${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span
            key={i + 1}
            className={i + 1 === today ? "home-cal-today" : "home-cal-d"}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
