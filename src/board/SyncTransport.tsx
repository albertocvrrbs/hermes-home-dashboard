// The shared transport of a board: one row per sync group, with play/pause, a scrubber, the time
// and the rate. Any card in the group (the video's own controls, a component's hb.clock) moves the
// same clock, so this is just one more view of it.
import { useEffect, useState } from "react";
import type { MessageKey } from "../home/i18n";
import { Icon } from "./icons";
import { RATES, formatClock, type GroupClock, type SyncHub } from "./syncClock";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

function Row({ clock, t }: { clock: GroupClock; t: T }) {
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  useEffect(() => {
    let raf = 0;
    const off = clock.subscribe(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; bump(); }); });
    return () => { off(); cancelAnimationFrame(raf); };
  }, [clock]);
  const s = clock.state;
  const next = RATES[(Math.max(0, RATES.findIndex((r) => r === s.rate)) + 1) % RATES.length];
  return (
    <div className="row" role="group" aria-label={t("board.sync.group", { group: clock.name })}>
      <span className="grp" data-tip={t(s.master ? "board.sync.master" : "board.sync.free")}><Icon name="sync" size={12} />{clock.name}</span>
      <button className="tool" data-nodrag="" aria-label={t("board.sync.rewind")} data-tip={t("board.sync.rewind")} onClick={() => void clock.seek(0)}><Icon name="skipBack" size={13} /></button>
      <button className="tool on" data-nodrag="" aria-label={t(s.playing ? "board.sync.pause" : "board.sync.play")} data-tip={t(s.playing ? "board.sync.pause" : "board.sync.play")}
        aria-pressed={s.playing} onClick={() => clock.toggle()}><Icon name={s.playing ? "pauseIcon" : "playIcon"} size={13} /></button>
      <input className="scrub" data-nodrag="" type="range" min={0} max={s.duration > 0 ? s.duration : Math.max(10, s.t * 1.25)} step={0.01} value={Math.min(s.t, s.duration > 0 ? s.duration : Infinity)}
        aria-label={t("board.sync.seek")}
        onChange={(e) => void clock.seek(Number(e.currentTarget.value))} />
      <span className="time">{formatClock(s.t)}{s.duration > 0 ? ` / ${formatClock(s.duration)}` : ""}</span>
      <button className="rate" data-nodrag="" aria-label={t("board.sync.rate")} data-tip={t("board.sync.rate")} onClick={() => clock.setRate(next)}>{s.rate}×</button>
      {s.manual && <span className="manual" data-tip={t("board.sync.manual")}>M</span>}
    </div>
  );
}

export function SyncTransport({ hub, groups, t }: { hub: SyncHub; groups: string[]; t: T }) {
  return (
    <div className="hb-sync" data-nodrag="">
      {groups.map((g) => <Row key={g} clock={hub.clock(g)} t={t} />)}
    </div>
  );
}
