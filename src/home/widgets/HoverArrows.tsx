import type { ReactNode } from "react";

/** Stops a control's clicks/pointer from bubbling to the WidgetShell, whose
 *  root div navigates on rest-mode click. Without this, tapping an arrow on a
 *  widget with `navigateTo` (gateway/sessions/tokens/cron/errors/host) would
 *  also route the page away. */
function swallow(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

interface HoverCtlProps {
  children: ReactNode;
  /** Extra class on the floating control (for per-widget positioning). */
  className?: string;
}

/** Floating chrome that fades in on widget hover and hides in edit mode —
 *  both behaviours come from the `.hover-ctl` CSS in home.css. Render any
 *  contextual control inside it (a toggle, a stepper, a menu). */
export function HoverCtl({ children, className }: HoverCtlProps) {
  return (
    <div
      className={`hover-ctl${className ? ` ${className}` : ""}`}
      onClick={swallow}
      onPointerDown={swallow}
    >
      {children}
    </div>
  );
}

interface HoverArrowsProps {
  onPrev: () => void;
  onNext: () => void;
  /** Centre content between the arrows (the current range/page/etc.). */
  label?: ReactNode;
  /** Makes the label itself a button (e.g. "today" reset on the calendar). */
  onLabelClick?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
}

/** The common `‹ label ›` hover control used by most widgets to step a range,
 *  page, or offset without entering edit mode. */
export function HoverArrows({
  onPrev, onNext, label, onLabelClick,
  prevDisabled, nextDisabled, className,
}: HoverArrowsProps) {
  return (
    <HoverCtl className={`hover-arrows${className ? ` ${className}` : ""}`}>
      <button
        className="hv-arrow"
        aria-label="previous"
        disabled={prevDisabled}
        onClick={(e) => { swallow(e); onPrev(); }}
      >
        ‹
      </button>
      {label !== undefined && (
        onLabelClick ? (
          <button
            className="hv-label hv-label-btn"
            onClick={(e) => { swallow(e); onLabelClick(); }}
          >
            {label}
          </button>
        ) : (
          <span className="hv-label">{label}</span>
        )
      )}
      <button
        className="hv-arrow"
        aria-label="next"
        disabled={nextDisabled}
        onClick={(e) => { swallow(e); onNext(); }}
      >
        ›
      </button>
    </HoverCtl>
  );
}
