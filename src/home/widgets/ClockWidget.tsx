import { useEffect, useState } from "react";
import { HoverCtl } from "./HoverArrows";

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Clock with hover toggles for 12/24h and a seconds readout. Both persist in
 *  the widget's layout props; the tick rate follows the seconds toggle. */
export function ClockWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const is12 = widgetProps.format === "12";
  const showSeconds = widgetProps.showSeconds === true;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), showSeconds ? 1_000 : 5_000);
    return () => clearInterval(t);
  }, [showSeconds]);

  const set = (patch: Record<string, unknown>) =>
    onWidgetPropsChange({ ...widgetProps, ...patch });

  let h = now.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  if (is12) { h = h % 12 || 12; }
  const hh = String(h).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <div className="home-clock-wrap">
      <HoverCtl>
        <button className="hv-opt" onClick={() => set({ format: is12 ? "24" : "12" })}>
          {is12 ? "12h" : "24h"}
        </button>
        <button
          className={`hv-opt${showSeconds ? " on" : ""}`}
          onClick={() => set({ showSeconds: !showSeconds })}
        >
          s
        </button>
      </HoverCtl>
      <div className="home-clock">
        {hh}:{mm}{showSeconds && <>:{ss}</>}
        {is12 && <span className="home-clock-ampm">{ampm}</span>}
      </div>
      <div className="home-clock-sub">
        {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}
