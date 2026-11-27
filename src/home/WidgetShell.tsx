import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { WidgetState } from "./widget-state";
import { useT, type MessageKey } from "./i18n";

const STATE_COPY: Partial<Record<WidgetState, MessageKey>> = {
  offline: "shell.offline",
  unavailable: "shell.unavailable",
};

interface Props {
  title: string;
  /** left/top/width/height in px, computed by GridCanvas. */
  style: CSSProperties;
  editing: boolean;
  dragging?: boolean;
  swapTarget?: boolean;
  /** Pointer is over the trash zone — dropping will delete this widget. */
  trashing?: boolean;
  /** Data-source health; offline/unavailable replace the body, stale keeps it. */
  state?: WidgetState;
  onRemove?: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  /** Rest-mode navigation (lock closed). */
  onClickThrough?: () => void;
  children: ReactNode;
}

export function WidgetShell({
  title, style, editing, dragging, swapTarget, trashing, state = "ok",
  onRemove, onHeaderPointerDown, onResizePointerDown, onClickThrough, children,
}: Props) {
  const t = useT();
  const stateKey = STATE_COPY[state];
  // The hover controls float over the header row; publishing the title's width lets the CSS
  // keep them clear of it (they wrap under the header instead of covering the title).
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (el && rootRef.current) rootRef.current.style.setProperty("--hd-title-w", `${el.offsetWidth}px`);
  }, [title, state]);
  const cls = [
    "home-widget",
    dragging ? "dragging" : "",
    swapTarget ? "swap-target" : "",
    trashing ? "trashing" : "",
  ].filter(Boolean).join(" ");
  return (
    <div
      ref={rootRef}
      className={cls}
      style={style}
      onClick={!editing && onClickThrough ? onClickThrough : undefined}
      role={!editing && onClickThrough ? "link" : undefined}
    >
      <b className="hd" onPointerDown={editing ? onHeaderPointerDown : undefined}>
        <span className="hd-t" ref={titleRef}>
          {title}
          {state === "stale" && <span className="hd-stale" title={t("shell.staleTitle")}> · {t("shell.stale")}</span>}
        </span>
      </b>
      {stateKey ? (
        <span className={`wstate wstate-${state}`}>{t(stateKey)}</span>
      ) : children}
      {editing && onRemove && (
        <button className="wremove" onClick={onRemove} aria-label={t("shell.remove", { title })}>
          ×
        </button>
      )}
      {editing && <div className="rs" onPointerDown={onResizePointerDown} />}
    </div>
  );
}
