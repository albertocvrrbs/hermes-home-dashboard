// Lucide icons, the same set (and version) Hermes Desktop draws its chrome with. Only the
// icons named here end up in the bundles: `lucide` is side-effect free, so the rest shakes out.
// Rendered like Desktop's sidebar: 24-unit viewBox, 2px round stroke, currentColor.
import {
  ArrowUp, ArrowUpRight, BrushCleaning, CalendarArrowDown, ChevronLeft, ChevronRight, CodeXml, Columns3, Copy,
  Group, Hand, Image, LayoutDashboard, Link, ListPlus, ListTodo, Maximize2, MessageSquareText, MousePointer2,
  MoveUpRight, PanelRightClose, Pencil, PencilLine, Plus, Redo2, RotateCw, Route, Scan, Split,
  SquareArrowOutUpRight, StickyNote, TextQuote, Trash2, Undo2, Workflow, X, ZoomIn, ZoomOut,
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
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 14, className }: { name: IconName; size?: number; className?: string }) {
  const node = ICONS[name];
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
