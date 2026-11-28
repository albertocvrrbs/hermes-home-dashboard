// The presentation HUD: a slim pill at the bottom of the stage. Stop n/N and its title (a
// frame's note under it), one cell per stop (the board's own progress motif), previous / next,
// auto-play and close. It fades out when the pointer rests, so a recording stays clean.
import { useEffect, useRef, useState } from "react";
import type { Translate } from "../home/i18n";
import { Icon } from "./icons";
import type { Presentation } from "./usePresentation";

const IDLE_MS = 2600;

export function PresenterHud({ p, t, board }: { p: Presentation; t: Translate; board: string }) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(0);
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => { window.removeEventListener("pointermove", wake); window.removeEventListener("keydown", wake); window.clearTimeout(timer.current); };
  }, []);
  if (!p.hud || !p.stops.length) return null;
  const n = p.stops.length, i = Math.min(p.ps.i, n - 1);
  const last = i >= n - 1;
  return (
    <div className={`hb-present${idle ? " idle" : ""}`} role="toolbar" aria-label={t("board.present.label")} onPointerDown={(e) => e.stopPropagation()}>
      <button className="ib" aria-label={t("board.present.prev")} data-tip={t("board.present.prev")} data-kbd="←" disabled={i === 0 && !p.tour?.loop} onClick={p.prev}><Icon name="prev" size={15} /></button>
      <div className="who" aria-live="polite">
        <span className="k">{p.depth > 0 ? `${board} · ` : ""}{String(i + 1).padStart(2, "0")}<i>/</i>{String(n).padStart(2, "0")}</span>
        <b>{p.title}</b>
        {p.note && <span className="note">{p.note}</span>}
      </div>
      <div className="cells" aria-hidden="true">
        {p.stops.map((_, j) => <i key={j} className={j < i ? "past" : j === i ? "on" : ""} />)}
      </div>
      <button className="ib" aria-label={last && !p.tour?.loop ? t("board.present.finish") : t("board.present.next")}
        data-tip={last && !p.tour?.loop ? t("board.present.finish") : t("board.present.next")} data-kbd="→" onClick={p.next}><Icon name="next" size={15} /></button>
      <i className="sep" />
      <button className={`ib${p.ps.auto ? " on" : ""}`} aria-pressed={p.ps.auto} aria-label={t("board.present.auto")}
        data-tip={t("board.present.auto")} data-kbd="P" onClick={p.toggleAuto}><Icon name={p.ps.auto ? "pause" : "play"} size={15} /></button>
      <button className="ib" aria-label={t("board.present.exit")} data-tip={t("board.present.exit")} data-kbd="Esc" onClick={p.stop}><Icon name="close" size={15} /></button>
    </div>
  );
}
