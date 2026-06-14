import { useEffect, useRef, useState } from "react";

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

/** Buttonless pomodoro:
 *  · click the time → start / pause
 *  · double-click the time (while paused) → set the work length in minutes
 *  · click the label → name the timer
 *  Auto-switches work ↔ break. Everything persists in the widget props. */
export function PomodoroWidget({ widgetProps, onWidgetPropsChange }: Props) {
  const state = readState(widgetProps);
  const label = typeof widgetProps.label === "string" ? widgetProps.label : "";
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<"name" | "minutes" | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  const toggle = () => {
    setNow(Date.now());
    if (state.endsAt === null) {
      commit({ ...state, endsAt: Date.now() + state.remaining * 1000 });
    } else {
      commit({ ...state, endsAt: null, remaining: secondsLeft });
    }
  };

  // Distinguish a single click (toggle) from a double click (edit minutes)
  // on the same element by deferring the single-click action briefly.
  const onTimeClick = () => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      toggle();
    }, 230);
  };
  const onTimeDouble = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (!running) setEditing("minutes");
  };

  const saveName = (value: string) => {
    setEditing(null);
    onWidgetPropsChange({ ...widgetProps, label: value.trim() });
  };
  const saveMinutes = (value: string) => {
    setEditing(null);
    const n = Math.max(1, Math.min(180, Math.round(Number(value) || state.workMin)));
    // Setting the length also resets the (paused) timer to that fresh length.
    commit({ ...state, workMin: n, mode: "work", endsAt: null, remaining: n * 60 });
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="home-clock-wrap home-pomo">
      {editing === "minutes" ? (
        <input
          className="note-input count-input pomo-min"
          type="number"
          min={1}
          max={180}
          autoFocus
          defaultValue={state.workMin}
          onBlur={(e) => saveMinutes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveMinutes(e.currentTarget.value);
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <div
          className={`home-clock${running ? "" : " paused"}`}
          onClick={onTimeClick}
          onDoubleClick={onTimeDouble}
          title="click: start/pause · double-click while paused: set minutes"
        >
          {mm}:{ss}
        </div>
      )}
      {editing === "name" ? (
        <input
          className="note-input count-input"
          autoFocus
          defaultValue={label}
          onBlur={(e) => saveName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName(e.currentTarget.value);
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <div
          className="home-clock-sub pomo-sub"
          onClick={() => setEditing("name")}
          title="click to name this timer"
        >
          {label ? `${label} · ` : ""}{state.mode} {running ? "· running" : "· paused"}
        </div>
      )}
    </div>
  );
}
