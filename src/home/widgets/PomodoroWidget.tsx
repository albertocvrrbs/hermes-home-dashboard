import { useEffect, useState } from "react";
import { HoverCtl } from "./HoverArrows";

interface PomoState {
  mode: "work" | "break";
  /** Epoch ms when the running timer ends; null = paused. */
  endsAt: number | null;
  /** Seconds left while paused. */
  remaining: number;
  workMin: number;
  breakMin: number;
}

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

function readState(p: Record<string, unknown>): PomoState {
  const s = p.pomodoro as Partial<PomoState> | undefined;
  const workMin = typeof s?.workMin === "number" ? s.workMin : 25;
  const breakMin = typeof s?.breakMin === "number" ? s.breakMin : 5;
  if (s && (s.mode === "work" || s.mode === "break")) {
    return {
      mode: s.mode,
      endsAt: typeof s.endsAt === "number" ? s.endsAt : null,
      remaining: typeof s.remaining === "number" ? s.remaining : workMin * 60,
      workMin, breakMin,
    };
  }
  return { mode: "work", endsAt: null, remaining: workMin * 60, workMin, breakMin };
}

const clampMin = (n: number) => Math.max(1, Math.min(180, Math.round(n)));

/** Pomodoro:
 *  · click the time → start / pause
 *  · hover → step the work / break lengths in minutes
 *  · click the label → name the timer
 *  Auto-switches work ↔ break. Everything persists in the widget props. */
export function PomodoroWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const state = readState(widgetProps);
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState(false); // naming the timer

  const commit = (next: PomoState) =>
    onWidgetPropsChange({ ...widgetProps, pomodoro: next });

  const secondsLeft = state.endsAt !== null
    ? Math.max(0, Math.round((state.endsAt - now) / 1000))
    : state.remaining;
  const running = state.endsAt !== null;

  useEffect(() => {
    if (state.endsAt === null) return;
    const t = setInterval(() => {
      if (state.endsAt !== null && state.endsAt - Date.now() <= 0) {
        const mode = state.mode === "work" ? "break" : "work";
        const remaining = (mode === "work" ? state.workMin : state.breakMin) * 60;
        commit({ ...state, mode, endsAt: null, remaining });
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.endsAt, state.mode]);

  const toggle = () => {
    setNow(Date.now());
    if (state.endsAt === null) {
      commit({ ...state, endsAt: Date.now() + state.remaining * 1000 });
    } else {
      commit({ ...state, endsAt: null, remaining: secondsLeft });
    }
  };

  // Setting the work length also resets the (paused) timer to that fresh
  // length; the break length just stores.
  const setWork = (n: number) =>
    commit({ ...state, workMin: clampMin(n), mode: "work", endsAt: null, remaining: clampMin(n) * 60 });
  const setBreak = (n: number) =>
    commit({ ...state, breakMin: clampMin(n) });

  const saveName = (value: string) => {
    setEditing(false);
    onWidgetPropsChange({ ...widgetProps, label: value.trim() });
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="home-clock-wrap home-pomo">
      <HoverCtl className="pomo-set">
        <div className="pomo-stepper">
          <span className="hv-label">work</span>
          <button className="hv-arrow" disabled={running} onClick={() => setWork(state.workMin - 1)}>‹</button>
          <span className="hv-label">{state.workMin}</span>
          <button className="hv-arrow" disabled={running} onClick={() => setWork(state.workMin + 1)}>›</button>
        </div>
        <div className="pomo-stepper">
          <span className="hv-label">break</span>
          <button className="hv-arrow" onClick={() => setBreak(state.breakMin - 1)}>‹</button>
          <span className="hv-label">{state.breakMin}</span>
          <button className="hv-arrow" onClick={() => setBreak(state.breakMin + 1)}>›</button>
        </div>
      </HoverCtl>
      <div
        className={`home-clock${running ? "" : " paused"}`}
        onClick={toggle}
        title="click: start / pause"
      >
        {mm}:{ss}
      </div>
      {editing ? (
        <input
          className="note-input count-input"
          autoFocus
          defaultValue={label}
          onBlur={(e) => saveName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName(e.currentTarget.value);
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <div
          className="home-clock-sub pomo-sub"
          onClick={() => setEditing(true)}
          title="click to name this timer"
        >
          {label ? `${label} · ` : ""}{state.mode} {running ? "· running" : "· paused"}
        </div>
      )}
    </div>
  );
}
