// Lucide icons, the same set (and version) Hermes Desktop draws its chrome with. Only the
// icons named here end up in the bundles: `lucide` is side-effect free, so the rest shakes out.
// Rendered like Desktop's sidebar: 24-unit viewBox, 2px round stroke, currentColor.
import {
  Activity, ArrowUp, ArrowUpRight, Bell, Bot, Brain, BrushCleaning, CalendarArrowDown, ChartLine, Check,
  ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CodeXml, Columns3, Copy, Cpu, Database, Download,
  FlaskConical, Gauge, GitBranch, Group, Hand, HardDrive, Image, LayoutDashboard, Link, ListPlus, ListTodo,
  Maximize2, MessageSquareText, MousePointer2, MoveUpRight, PanelRightClose, Pause, Pencil, PencilLine, Play,
  Plus, Power, Redo2, RefreshCw, Rocket, RotateCw, Route, Scan, Server, Split, Square, SquareArrowOutUpRight,
  SquareDashedMousePointer, SquareTerminal, StickyNote, TextQuote, Timer, Trash2, Undo2, Upload, Video,
  Workflow, X, Zap, ZoomIn, ZoomOut,
  type IconNode,
} from "lucide";

export const ICONS = {
  select: MousePointer2,
  pan: Hand,
  note: StickyNote,
  todo: ListTodo,
  link: Link,
  image: Image,
  col: Columns3,
  board: LayoutDashboard,
  embed: CodeXml,
  arrow: MoveUpRight,
  draw: PencilLine,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fit: Scan,
  undo: Undo2,
  redo: Redo2,
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  connect: MoveUpRight,
  open: SquareArrowOutUpRight,
  openBoard: ArrowUpRight,
  chat: MessageSquareText,
  closePanel: PanelRightClose,
  send: ArrowUp,
  close: X,
  plus: Plus,
  prev: ChevronLeft,
  next: ChevronRight,
  reload: RotateCw,
  taller: Maximize2,
  // Hermes verbs
  expand: ListPlus,
  split: Split,
  diagram: Workflow,
  sortDate: CalendarArrowDown,
  flow: Route,
  group: Group,
  summarize: TextQuote,
  improve: BrushCleaning,
  selectAll: SquareDashedMousePointer,
  video: Video,
  ok: CircleCheck,
  alert: CircleAlert,
  check: Check,
} satisfies Record<string, IconNode>;

/** Icons a live card may name (header `icon`, button `icon`). Unknown names fall back. */
export const LIVE_ICONS: Record<string, IconNode> = {
  activity: Activity, gauge: Gauge, cpu: Cpu, "square-terminal": SquareTerminal, terminal: SquareTerminal,
  timer: Timer, rocket: Rocket, bot: Bot, brain: Brain, server: Server, database: Database,
  "flask-conical": FlaskConical, flask: FlaskConical, "chart-line": ChartLine, chart: ChartLine,
  "hard-drive": HardDrive, "git-branch": GitBranch, bell: Bell, zap: Zap, video: Video,
  square: Square, stop: Square, play: Play, pause: Pause, "refresh-cw": RefreshCw, refresh: RefreshCw,
  power: Power, upload: Upload, download: Download, check: Check,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 14, className, node: given }: { name?: IconName; size?: number; className?: string; node?: IconNode }) {
  const node = given ?? ICONS[name ?? "plus"];
  return (
    <svg className={`ic${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {node.map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string | number>)} />;
      })}
    </svg>
  );
}
