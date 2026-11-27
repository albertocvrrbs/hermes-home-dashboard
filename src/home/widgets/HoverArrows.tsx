import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n";

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
  const ref = useRef<HTMLDivElement>(null);
  // Publish the controls' width on the widget so the header rule can stop short of them,
  // and flag the widget as tight when title + controls don't fit side by side.
  useEffect(() => {
    const el = ref.current;
    const widget = el?.closest(".home-widget") as HTMLElement | null;
    if (!el || !widget || el.classList.contains("pomo-set")) return;
    const measure = () => {
      const w = el.scrollWidth;
      widget.style.setProperty("--ctl-w", `${w}px`);
      const title = widget.querySelector(".hd .hd-t") as HTMLElement | null;
      const inner = widget.clientWidth - 24; // .home-widget horizontal padding
      const need = 12 + 10 + (title?.offsetWidth ?? 0) + 16 + w;
      if (need > inner) widget.setAttribute("data-ctl-tight", "");
      else widget.removeAttribute("data-ctl-tight");
    };
    measure();
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    ro?.observe(widget);
    return () => {
      ro?.disconnect();
      widget.style.removeProperty("--ctl-w");
      widget.removeAttribute("data-ctl-tight");
    };
  });
  return (
    <div
      ref={ref}
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
  const t = useT();
  return (
    <HoverCtl className={`hover-arrows${className ? ` ${className}` : ""}`}>
      <button
        className="hv-arrow"
        aria-label={t("common.previous")}
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
        aria-label={t("common.next")}
        disabled={nextDisabled}
        onClick={(e) => { swallow(e); onNext(); }}
      >
        ›
      </button>
    </HoverCtl>
  );
}
