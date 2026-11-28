// The Draw tool's sub-toolbar: ink tools, shapes, width presets, palette and style toggles.
// Same chrome as the status bar (lucide icons, tips with name + shortcut, hairline separators);
// it wraps onto a second row instead of overflowing on narrow boards.
import type { MessageKey, Translate } from "../home/i18n";
import { Icon, type IconName } from "./icons";
import { HL_WIDTHS, INK_COLORS, PEN_WIDTHS, type InkColor, type InkSettings, type InkTool } from "./ink";

const TOOLS: { tool: InkTool; icon: IconName; label: MessageKey; kbd?: string }[] = [
  { tool: "pen", icon: "pen", label: "board.ink.pen", kbd: "D" },
  { tool: "hl", icon: "highlighter", label: "board.ink.hl", kbd: "⇧D" },
  { tool: "eraser", icon: "eraser", label: "board.ink.eraser", kbd: "E" },
  { tool: "lasso", icon: "lasso", label: "board.ink.lasso" },
];
const SHAPE_TOOLS: { tool: InkTool; icon: IconName; label: MessageKey }[] = [
  { tool: "line", icon: "line", label: "board.ink.line" },
  { tool: "arrow", icon: "inkArrow", label: "board.ink.arrow" },
  { tool: "rect", icon: "rect", label: "board.ink.rect" },
  { tool: "ellipse", icon: "ellipse", label: "board.ink.ellipse" },
];
const WIDTH_LABEL: MessageKey[] = ["board.ink.thin", "board.ink.medium", "board.ink.thick"];
const SMOOTH_LABEL: MessageKey[] = ["board.ink.smoothOff", "board.ink.smoothOn", "board.ink.smoothStrong"];

export function InkBar({ ink, onChange, t }: { ink: InkSettings; onChange: (next: InkSettings) => void; t: Translate }) {
  const hl = ink.tool === "hl";
  const widths = hl ? HL_WIDTHS : PEN_WIDTHS;
  const wIdx = hl ? ink.w.hl : ink.w.pen;
  const inkless = ink.tool === "eraser" || ink.tool === "lasso";
  const set = (p: Partial<InkSettings>) => onChange({ ...ink, ...p });
  const toolBtn = (x: { tool: InkTool; icon: IconName; label: MessageKey; kbd?: string }) => (
    <button key={x.tool} className={`tool${ink.tool === x.tool ? " on" : ""}`} aria-pressed={ink.tool === x.tool}
      aria-label={t(x.label)} data-tip={t(x.label)} data-kbd={x.kbd} onClick={() => set({ tool: x.tool })}>
      <Icon name={x.icon} size={15} />
    </button>
  );
  return (
    <div className="hb-inkbar" role="toolbar" aria-label={t("board.ink.bar")} data-nodrag
      onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="seg">{TOOLS.map(toolBtn)}</div>
      <div className="seg">{SHAPE_TOOLS.map(toolBtn)}</div>
      <div className={`seg${inkless ? " off" : ""}`}>
        {widths.map((_, i) => (
          <button key={i} className={`tool sw${wIdx === i ? " on" : ""}`} aria-pressed={wIdx === i} disabled={inkless}
            aria-label={t(WIDTH_LABEL[i])} data-tip={t(WIDTH_LABEL[i])} data-kbd="[ ]"
            onClick={() => set({ w: { ...ink.w, [hl ? "hl" : "pen"]: i } })}>
            <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
          </button>
        ))}
      </div>
      <div className={`seg${inkless ? " off" : ""}`}>
        {INK_COLORS.map((c: InkColor, i) => (
          <button key={c} className={`tool sw-c c-${c}${ink.c === c ? " on" : ""}`} aria-pressed={ink.c === c} disabled={inkless}
            aria-label={t(`board.ink.color.${c}` as MessageKey)} data-tip={t(`board.ink.color.${c}` as MessageKey)} data-kbd={String(i + 1)}
            onClick={() => set({ c })}>
            <i />
          </button>
        ))}
      </div>
      <div className={`seg${inkless ? " off" : ""}`}>
        <button className={`tool${ink.ds ? " on" : ""}`} aria-pressed={ink.ds} disabled={inkless}
          aria-label={t("board.ink.dashed")} data-tip={t("board.ink.dashed")} onClick={() => set({ ds: !ink.ds })}>
          <Icon name="dashed" size={15} />
        </button>
        <button className={`tool smooth${ink.sm ? " on" : ""} lv${ink.sm}`} aria-pressed={ink.sm > 0} disabled={inkless}
          aria-label={t(SMOOTH_LABEL[ink.sm])} data-tip={t(SMOOTH_LABEL[ink.sm])}
          onClick={() => set({ sm: ((ink.sm + 1) % 3) as InkSettings["sm"] })}>
          <Icon name="smooth" size={15} />
          <b aria-hidden="true">{ink.sm === 2 ? "2" : ""}</b>
        </button>
      </div>
    </div>
  );
}
