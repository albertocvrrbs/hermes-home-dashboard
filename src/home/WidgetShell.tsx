import type { CSSProperties, ReactNode } from "react";

interface Props {
  title: string;
  /** left/top/width/height in px, computed by GridCanvas. */
  style: CSSProperties;
  editing: boolean;
  dragging?: boolean;
  swapTarget?: boolean;
  /** Pointer is over the trash zone — dropping will delete this widget. */
  trashing?: boolean;
  /** Data source failed — render a compact error state instead of children. */
  error?: boolean;
  onRemove?: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  /** Rest-mode navigation (lock closed). */
  onClickThrough?: () => void;
  children: ReactNode;
}

export function WidgetShell({
  title, style, editing, dragging, swapTarget, trashing, error,
  onRemove, onHeaderPointerDown, onResizePointerDown, onClickThrough, children,
}: Props) {
  const cls = [
    "home-widget",
    dragging ? "dragging" : "",
    swapTarget ? "swap-target" : "",
    trashing ? "trashing" : "",
  ].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      style={style}
      onClick={!editing && onClickThrough ? onClickThrough : undefined}
      role={!editing && onClickThrough ? "link" : undefined}
    >
      <b className="hd" onPointerDown={editing ? onHeaderPointerDown : undefined}>
        {title}
      </b>
      {error ? <span className="werr">● no data</span> : children}
      {editing && onRemove && (
        <button className="wremove" onClick={onRemove} aria-label={`Remove ${title}`}>
          ×
        </button>
      )}
      {editing && <div className="rs" onPointerDown={onResizePointerDown} />}
    </div>
  );
}
