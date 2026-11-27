// One tooltip for every board surface: any element with `data-tip` (and optional `data-kbd`)
// shows its name and shortcut after a short hover. A single node lives on <body>, so tips are
// never clipped by a widget's overflow or a transformed parent. Delay 300 ms; once a tip has
// shown, neighbours open at once for 300 ms (the same "warm" rule Hermes Desktop uses).
import { placeTip } from "./float";

const DELAY_MS = 300;
const WARM_MS = 300;

let tipEl: HTMLDivElement | null = null;
let showTimer = 0;
let warmUntil = 0;
let current: HTMLElement | null = null;

function node(): HTMLDivElement {
  if (tipEl?.isConnected) return tipEl;
  tipEl = document.createElement("div");
  tipEl.className = "hb-tip";
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);
  return tipEl;
}

function show(target: HTMLElement) {
  const label = target.dataset.tip;
  if (!label || !target.isConnected) return;
  const el = node();
  el.textContent = "";
  const span = document.createElement("span");
  span.textContent = label;
  el.appendChild(span);
  const kbd = target.dataset.kbd;
  if (kbd) {
    for (const k of kbd.split(" ")) {
      const k1 = document.createElement("kbd");
      k1.textContent = k;
      el.appendChild(k1);
    }
  }
  el.classList.remove("on");
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.display = "flex";
  const r = target.getBoundingClientRect();
  const size = { w: el.offsetWidth, h: el.offsetHeight };
  const p = placeTip({ x: r.left, y: r.top, w: r.width, h: r.height }, size,
    { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  el.dataset.side = p.side;
  // next frame so the fade runs
  requestAnimationFrame(() => el.classList.add("on"));
}

function hide(warm: boolean) {
  window.clearTimeout(showTimer);
  if (tipEl && tipEl.classList.contains("on") && warm) warmUntil = Date.now() + WARM_MS;
  if (tipEl) { tipEl.classList.remove("on"); tipEl.style.display = "none"; }
  current = null;
}

function tipTarget(e: Event): HTMLElement | null {
  const t = e.target as HTMLElement | null;
  return (t?.closest?.("[data-tip]") as HTMLElement | null) ?? null;
}

/** Wires the delegated listeners on a surface root. Returns the disposer. */
export function installTips(root: HTMLElement): () => void {
  const over = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const t = tipTarget(e);
    if (t === current) return;
    if (!t) { if (current) hide(true); return; }
    hide(true);
    current = t;
    const wait = Date.now() < warmUntil ? 0 : DELAY_MS;
    showTimer = window.setTimeout(() => { if (current === t) show(t); }, wait);
  };
  const leave = () => hide(true);
  const down = () => hide(false);
  const focus = (e: FocusEvent) => {
    const t = tipTarget(e);
    if (!t || !(t as HTMLElement).matches?.(":focus-visible")) return;
    current = t;
    show(t);
  };
  const blur = () => hide(false);
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerleave", leave);
  root.addEventListener("pointerdown", down, true);
  root.addEventListener("wheel", down, { passive: true });
  root.addEventListener("focusin", focus);
  root.addEventListener("focusout", blur);
  window.addEventListener("keydown", down, true);
  return () => {
    root.removeEventListener("pointerover", over);
    root.removeEventListener("pointerleave", leave);
    root.removeEventListener("pointerdown", down, true);
    root.removeEventListener("wheel", down);
    root.removeEventListener("focusin", focus);
    root.removeEventListener("focusout", blur);
    window.removeEventListener("keydown", down, true);
    hide(false);
  };
}
