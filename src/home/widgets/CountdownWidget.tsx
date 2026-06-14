import { useEffect, useState } from "react";

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Buttonless countdown to a date you set: click the label or the date to
 *  edit them inline. Counts up (with +) once the moment passes. */
export function CountdownWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const target = typeof widgetProps.target === "string" ? widgetProps.target : "";
  const [editing, setEditing] = useState<"label" | "target" | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const save = (key: "label" | "target", value: string) => {
    setEditing(null);
    onWidgetPropsChange({ ...widgetProps, [key]: value.trim() });
  };

  // Accepts a plain date (YYYY-MM-DD, parsed as local midnight) or a legacy
  // datetime-local value. Local parsing avoids the UTC off-by-a-day trap.
  const targetMs = target
    ? new Date(target.length === 10 ? `${target}T00:00:00` : target).getTime()
    : NaN;
  let big = "—";
  if (!Number.isNaN(targetMs)) {
    const diff = targetMs - now;
    const abs = Math.abs(diff);
    const d = Math.floor(abs / 86_400_000);
    const h = Math.floor((abs % 86_400_000) / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    big = `${diff < 0 ? "+" : ""}${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return (
    <div className="home-clock-wrap home-count">
      {editing === "target" ? (
        <input
          className="note-input count-input"
          type="date"
          autoFocus
          defaultValue={target.slice(0, 10)}
          onChange={(e) => save("target", e.target.value)}
          onBlur={(e) => save("target", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save("target", e.currentTarget.value);
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <div
          className="home-clock count-big"
          onClick={() => setEditing("target")}
          title="click to set the date"
        >
          {big}
        </div>
      )}
      {editing === "label" ? (
        <input
          className="note-input count-input"
          autoFocus
          defaultValue={label}
          onBlur={(e) => save("label", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save("label", e.currentTarget.value);
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <div
          className="home-clock-sub count-label"
          onClick={() => setEditing("label")}
          title="click to edit the label"
        >
          {label || "click to name this countdown"}
        </div>
      )}
    </div>
  );
}
