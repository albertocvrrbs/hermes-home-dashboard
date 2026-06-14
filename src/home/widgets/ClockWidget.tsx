import { useEffect, useState } from "react";

export function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="home-clock-wrap">
      <div className="home-clock">{hh}:{mm}</div>
      <div className="home-clock-sub">
        {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}
