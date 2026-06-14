import { useEffect, useState } from "react";
import { HoverArrows } from "./HoverArrows";

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface Seg { y: number; mo: number; d: number; h: number; mi: number; }

const buildISO = (s: Seg) => `${s.y}-${pad(s.mo + 1)}-${pad(s.d)}T${pad(s.h)}:${pad(s.mi)}`;
const fromDate = (dt: Date): Seg =>
  ({ y: dt.getFullYear(), mo: dt.getMonth(), d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() });
const daysIn = (y: number, mo: number) => new Date(y, mo + 1, 0).getDate();

function parseTargetMs(target: string): number {
  if (!target) return NaN;
  return new Date(target.length === 10 ? `${target}T00:00:00` : target).getTime();
}
function parseSeg(target: string): Seg | null {
  const ms = parseTargetMs(target);
  return Number.isNaN(ms) ? null : fromDate(new Date(ms));
}

/** One spinner segment: wheel, ▲▼ buttons, keyboard ↑↓, and (numeric only)
 *  direct typing committed on blur. Month is a non-typed name spinner. */
function NumSeg({
  value, width, label, onStep, onCommit,
}: {
  value: number; width: number; label: string;
  onStep: (d: number) => void; onCommit: (n: number) => void;
}) {
  const [buf, setBuf] = useState<string | null>(null);
  return (
    <div className="count-seg" onWheel={(e) => { e.preventDefault(); onStep(e.deltaY < 0 ? 1 : -1); }}>
      <button className="seg-btn" tabIndex={-1} aria-label={`${label} up`} onClick={() => { setBuf(null); onStep(1); }}>▲</button>
      <input
        className="seg-val"
        style={{ width }}
        value={buf ?? pad(value)}
        inputMode="numeric"
        aria-label={label}
        onChange={(e) => setBuf(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => { if (buf !== null) { const n = parseInt(buf, 10); if (!Number.isNaN(n)) onCommit(n); setBuf(null); } }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp") { e.preventDefault(); setBuf(null); onStep(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); setBuf(null); onStep(-1); }
        }}
      />
      <button className="seg-btn" tabIndex={-1} aria-label={`${label} down`} onClick={() => { setBuf(null); onStep(-1); }}>▼</button>
    </div>
  );
}

function MonSeg({ value, onStep }: { value: number; onStep: (d: number) => void }) {
  return (
    <div className="count-seg" onWheel={(e) => { e.preventDefault(); onStep(e.deltaY < 0 ? 1 : -1); }}>
      <button className="seg-btn" tabIndex={-1} aria-label="month up" onClick={() => onStep(1)}>▲</button>
      <div className="seg-val seg-static" style={{ width: 36 }}>{MONTHS[value]}</div>
      <button className="seg-btn" tabIndex={-1} aria-label="month down" onClick={() => onStep(-1)}>▼</button>
    </div>
  );
}

/** Countdown to a date+time you set. Click the big readout to open an
 *  alarm-style segment editor (month/day/year + hour:minute), click the label
 *  to name it, or use the hover arrows for a quick ±1 day. Counts up (with +)
 *  once the moment passes. */
export function CountdownWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const target = typeof widgetProps.target === "string" ? widgetProps.target : "";
  const [mode, setMode] = useState<"none" | "datetime" | "label">("none");
  const [seg, setSeg] = useState<Seg | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const targetMs = parseTargetMs(target);

  const commitSeg = (s: Seg) => {
    setSeg(s);
    onWidgetPropsChange({ ...widgetProps, target: buildISO(s) });
  };

  const openDatetime = () => {
    setSeg(parseSeg(target) ?? fromDate(new Date()));
    setMode("datetime");
  };

  const stepField = (field: "year" | "month" | "day" | "hour" | "min", delta: number) => {
    if (!seg) return;
    if (field === "year") {
      const y = seg.y + delta;
      commitSeg({ ...seg, y, d: Math.min(seg.d, daysIn(y, seg.mo)) });
    } else if (field === "month") {
      const mo = (seg.mo + delta + 12) % 12;
      commitSeg({ ...seg, mo, d: Math.min(seg.d, daysIn(seg.y, mo)) });
    } else {
      const dt = new Date(seg.y, seg.mo, seg.d, seg.h, seg.mi);
      if (field === "day") dt.setDate(dt.getDate() + delta);
      if (field === "hour") dt.setHours(dt.getHours() + delta);
      if (field === "min") dt.setMinutes(dt.getMinutes() + delta);
      commitSeg(fromDate(dt));
    }
  };

  const commitField = (field: "year" | "day" | "hour" | "min", n: number) => {
    if (!seg) return;
    if (field === "year") {
      const y = Math.min(2200, Math.max(1970, n));
      commitSeg({ ...seg, y, d: Math.min(seg.d, daysIn(y, seg.mo)) });
    } else if (field === "day") {
      commitSeg({ ...seg, d: Math.min(daysIn(seg.y, seg.mo), Math.max(1, n)) });
    } else if (field === "hour") {
      commitSeg({ ...seg, h: Math.min(23, Math.max(0, n)) });
    } else {
      commitSeg({ ...seg, mi: Math.min(59, Math.max(0, n)) });
    }
  };

  const shiftDays = (delta: number) => {
    const base = !Number.isNaN(targetMs) ? new Date(targetMs) : new Date();
    base.setDate(base.getDate() + delta);
    onWidgetPropsChange({ ...widgetProps, target: buildISO(fromDate(base)) });
  };

  const saveLabel = (value: string) => {
    setMode("none");
    onWidgetPropsChange({ ...widgetProps, label: value.trim() });
  };

  // ── datetime editor ──
  if (mode === "datetime" && seg) {
    return (
      <div className="home-clock-wrap home-count">
        <div className="count-edit">
          <div className="count-edit-row">
            <MonSeg value={seg.mo} onStep={(d) => stepField("month", d)} />
            <NumSeg value={seg.d} width={22} label="day"
              onStep={(d) => stepField("day", d)} onCommit={(n) => commitField("day", n)} />
            <NumSeg value={seg.y} width={42} label="year"
              onStep={(d) => stepField("year", d)} onCommit={(n) => commitField("year", n)} />
          </div>
          <div className="count-edit-row">
            <NumSeg value={seg.h} width={22} label="hour"
              onStep={(d) => stepField("hour", d)} onCommit={(n) => commitField("hour", n)} />
            <span className="count-colon">:</span>
            <NumSeg value={seg.mi} width={22} label="minute"
              onStep={(d) => stepField("min", d)} onCommit={(n) => commitField("min", n)} />
          </div>
          <button className="count-done" onClick={() => { setMode("none"); setSeg(null); }}>done</button>
        </div>
      </div>
    );
  }

  // ── normal view ──
  let big = "—";
  if (!Number.isNaN(targetMs)) {
    const diff = targetMs - now;
    const abs = Math.abs(diff);
    const d = Math.floor(abs / 86_400_000);
    const h = Math.floor((abs % 86_400_000) / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    big = `${diff < 0 ? "+" : ""}${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}`;
  }
  const dateLabel = !Number.isNaN(targetMs)
    ? new Date(targetMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "set date";

  return (
    <div className="home-clock-wrap home-count">
      <HoverArrows onPrev={() => shiftDays(-1)} onNext={() => shiftDays(1)} label={dateLabel} />
      <div
        className="home-clock count-big"
        onClick={openDatetime}
        title="click to set the date & time"
      >
        {big}
      </div>
      {mode === "label" ? (
        <input
          className="note-input count-input"
          autoFocus
          defaultValue={label}
          onBlur={(e) => saveLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveLabel(e.currentTarget.value);
            if (e.key === "Escape") setMode("none");
          }}
        />
      ) : (
        <div
          className="home-clock-sub count-label"
          onClick={() => setMode("label")}
          title="click to edit the label"
        >
          {label || "click to name this countdown"}
        </div>
      )}
    </div>
  );
}
