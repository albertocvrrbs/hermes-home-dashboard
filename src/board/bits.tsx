// Small shared pieces: Hermes' pixel caduceus, time formatting, the **bold** subset.
import type { ReactNode } from "react";
import type { Translate } from "../home/i18n";
import { fmtDate } from "../home/i18n/date";

// The Home's dot-matrix caduceus reduced to a 9x11 bitmap (mockup-v2 #cad).
const CAD: [number, number, number, number][] = [
  [4, 0, 1, 11], [0, 1, 3, 1], [6, 1, 3, 1], [1, 2, 2, 1], [6, 2, 2, 1], [2, 3, 5, 1],
  [2, 5, 2, 1], [5, 4, 2, 1], [2, 6, 1, 1], [6, 5, 1, 2], [5, 7, 1, 1], [3, 7, 1, 1],
  [2, 8, 1, 1], [6, 8, 1, 1], [3, 9, 1, 1], [5, 9, 1, 1],
];

export function Cad({ className = "px", size }: { className?: string; size?: [number, number] }) {
  return (
    <svg className={className} viewBox="0 0 9 11" aria-hidden="true"
      style={size ? { width: size[0], height: size[1] } : undefined}>
      {CAD.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}
    </svg>
  );
}

export function Sig({ label = "hermes" }: { label?: string }) {
  return <span className="sig"><Cad />{label}</span>;
}

export function ago(t: Translate, ts: number | undefined, now = Date.now() / 1000): string {
  if (!ts) return "";
  const s = Math.max(0, now - ts);
  if (s < 45) return t("board.time.now");
  if (s < 3600) return t("board.time.min", { n: Math.round(s / 60) });
  if (s < 86400) return t("board.time.h", { n: Math.round(s / 3600) });
  if (s < 172800) return t("board.time.yesterday");
  const d = new Date(ts * 1000);
  return fmtDate(d, { month: "short", day: "numeric" }).toLowerCase();
}

export function clock(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Plain text with the `**bold**` subset, as React text (never HTML). A ```fenced``` block (what
 *  imported code files arrive as) is shown as a monospaced block. */
export function RichText({ text }: { text: string }): ReactNode {
  if (text.includes("```")) {
    const chunks = text.split(/```[^\n]*\n([\s\S]*?)(?:\n```|$)/g);
    return (
      <>
        {chunks.map((c, i) => (i % 2 === 1 ? <pre key={i} className="code">{c}</pre> : c ? <RichText key={i} text={c.replace(/^\n+|\n+$/g, "")} /> : null))}
      </>
    );
  }
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4
        ? <b key={i}>{p.slice(2, -2)}</b>
        : <span key={i}>{p}</span>))}
    </>
  );
}

/** "due today" in amber, other dates plain. */
export function dueLabel(t: Translate, due: string): { text: string; today: boolean } {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due === iso || due.toLowerCase() === "today") return { text: t("board.dueToday"), today: true };
  return { text: due, today: false };
}
