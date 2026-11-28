// Lucide icons, the same set (and version) Hermes Desktop draws its chrome with. Only the
// icons named here end up in the bundles: `lucide` is side-effect free, so the rest shakes out.
// Rendered like Desktop's sidebar: 24-unit viewBox, 2px round stroke, currentColor.
import {
  Palette, Activity, BookOpen, Eye, FilePen, FileText, Globe, Search, Wrench, ArrowUp, ArrowUpRight, Bell, Bot, Brain, BrushCleaning, CalendarArrowDown, ChartLine, Check,
  ChevronLeft, ChevronRight, Circle, Diamond, Ellipsis, LayoutGrid, Magnet, RectangleHorizontal, Type, CircleAlert, CircleCheck, CodeXml, Columns3, Copy, Cpu, Database, Download, Eraser,
  FlaskConical, Focus, Gauge, GitBranch, Group, Hand, HardDrive, Highlighter, Image, LassoSelect, LayoutDashboard, Link, ListPlus, ListTodo,
  Maximize2, MessageSquareText, MousePointer2, MoveUpRight, PanelRightClose, Pause, Pen, Pencil, PencilLine, Play,
  Plus, Power, Redo2, RotateCcw, RefreshCw, Rocket, RotateCw, Route, Scan, Server, Slash, Spline, Split, Square, SquareArrowOutUpRight, SquareDashed,
  SquareDashedMousePointer, SquareTerminal, StickyNote, TextQuote, Timer, Trash2, Undo2, Ungroup, Upload, Video,
  Workflow, X, Zap, ZoomIn, ZoomOut, Box, Clock, Blocks, Link2, CircleArrowUp, History, SkipBack,
  type IconNode,
} from "lucide";

// lucide has no plain stadium; this is its rectangle with full corner radius, same 24-unit grid
const PILL: IconNode = [["rect", { x: 2, y: 7, width: 20, height: 10, rx: 5 }]];

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
  focus: Focus,
  undo: Undo2,
  redo: Redo2,
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  connect: MoveUpRight,
  open: SquareArrowOutUpRight,
  openBoard: ArrowUpRight,
  reset: RotateCcw,
  chat: MessageSquareText,
  toolReadBoard: Eye, toolEditBoard: PencilLine, toolViewBoard: Eye, toolSkill: BookOpen, toolCommand: SquareTerminal,
  toolReadFile: FileText, toolEditFile: FilePen, toolSearch: Search, toolWeb: Globe, toolImage: Image,
  toolPlan: ListTodo, toolMemory: Brain, toolDelegate: Bot, toolOther: Wrench,
  closePanel: PanelRightClose,
  send: ArrowUp,
  close: X,
  plus: Plus,
  prev: ChevronLeft,
  next: ChevronRight,
  reload: RotateCw,
  taller: Maximize2,
  theme: Palette,
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
  markOk: Check, markFail: X, markWait: Clock, fileDoc: FileText, model3d: Box, fileOpen: SquareArrowOutUpRight, fileGet: Download,
  alert: CircleAlert,
  check: Check,
  // Draw tool
  pen: Pen,
  highlighter: Highlighter,
  eraser: Eraser,
  lasso: LassoSelect,
  line: Slash,
  inkArrow: ArrowUpRight,
  rect: Square,
  ellipse: Circle,
  dashed: SquareDashed,
  smooth: Spline,
  ungroup: Ungroup,
  // layout
  tidy: LayoutGrid,
  snap: Magnet,
  more: Ellipsis,
  text: Type,
  shapeRect: RectangleHorizontal,
  shapeDiamond: Diamond,
  shapePill: PILL,
  shapeCircle: Circle,
  // components + sync
  components: Blocks,
  sync: Link2,
  upgrade: CircleArrowUp,
  versions: History,
  skipBack: SkipBack,
  playIcon: Play,
  pauseIcon: Pause,
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
