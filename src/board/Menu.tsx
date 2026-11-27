// Right-click menu for the board: one list of actions (icon · name · shortcut), opened at the
// pointer and kept inside the board (flips left/up at the edges). Arrow keys move, Enter runs,
// Esc or any click outside closes.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cad } from "./bits";
import { placeMenu } from "./float";
import { Icon, type IconName } from "./icons";

export type MenuEntry =
  | { sep: true }
  | { head: string; hermes?: boolean }
  | { id: string; label: string; icon?: IconName; kbd?: string; danger?: boolean; hermes?: boolean; run: () => void };

export function BoardMenu({ at, entries, bounds, onClose }: {
  at: { x: number; y: number };
  entries: MenuEntry[];
  bounds: { x: number; y: number; w: number; h: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeMenu(at, { w: el.offsetWidth, h: el.offsetHeight }, bounds));
    (el.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }, [at, bounds]);

  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const blur = () => onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", blur);
    };
  }, [onClose]);

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    const btns = [...(ref.current?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const n = btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length];
    n?.focus();
  };

  return (
    <div ref={ref} className="hb-menu" role="menu" onKeyDown={move} onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      style={pos ? { left: pos.x, top: pos.y } : { left: at.x, top: at.y, visibility: "hidden" }}>
      {entries.map((m, i) => {
        if ("sep" in m) return <div key={i} className="sep" role="separator" />;
        if ("head" in m) return <div key={i} className="head">{m.hermes && <Cad />}{m.head}</div>;
        return (
          <button key={m.id} role="menuitem" className={`${m.danger ? "danger" : ""}${m.hermes ? " hm" : ""}`.trim() || undefined}
            onClick={() => { onClose(); m.run(); }}>
            <span className="ico">{m.icon && <Icon name={m.icon} />}</span>
            <span className="lb">{m.label}</span>
            {m.kbd && <kbd>{m.kbd}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
