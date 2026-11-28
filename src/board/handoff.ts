// Page transitions between board surfaces. The page being left is cloned into a fixed overlay
// (so it survives the route change), the next page mounts underneath, and both move on one
// camera: the overlay by the similarity that matches the arriving view (transition.ts).
//   in  — Home widget or nested-board card -> the board's page: the miniature opens up.
//   out — a nested board -> its parent: the page shrinks back into its card.
import { Camera, type Size } from "./camera";
import type { View } from "./geometry";
import { miniFitOf } from "./miniboard";
import { affineCss, arrivingOpacity, fromPage, leavingOpacity, matchTransform, toPage, ZOOM_EASE, ZOOM_IN_MS, ZOOM_OUT_MS } from "./transition";

export interface Handoff {
  kind: "in" | "out";
  /** board that mounts next */
  to: string;
  /** for "out": the board being left (its card is looked up in the parent) */
  child?: string;
  overlay: HTMLElement;
  /** page-coordinate view under which the old page's content is currently drawn */
  from: View;
  at: number;
  guard: number;
}

let pending: Handoff | null = null;
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A clone of `root` in a fixed overlay at the same place. */
function snapshot(root: HTMLElement): HTMLElement {
  const r = root.getBoundingClientRect();
  const wrap = document.createElement("div");
  wrap.className = "hb-xfade";
  wrap.setAttribute("inert", "");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.style.width = `${r.width}px`;
  clone.style.height = `${r.height}px`;
  clone.style.margin = "0";
  clone.style.transformOrigin = "0 0";
  // canvases clone empty; iframes would reload; ids would clash; scroll positions reset
  const src = root.querySelectorAll("canvas"), dst = clone.querySelectorAll("canvas");
  src.forEach((c, i) => {
    try { dst[i]?.getContext("2d")?.drawImage(c, 0, 0); } catch { /* tainted: leave blank */ }
  });
  clone.querySelectorAll("iframe").forEach((f) => { const d = document.createElement("div"); d.className = (f as HTMLElement).className; d.style.cssText = (f as HTMLElement).style.cssText; f.replaceWith(d); });
  clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
  wrap.appendChild(clone);
  document.body.appendChild(wrap);
  const a = [root, ...root.querySelectorAll<HTMLElement>("*")], b = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  for (let i = 0; i < a.length; i++) if (a[i].scrollTop || a[i].scrollLeft) { b[i].scrollTop = a[i].scrollTop; b[i].scrollLeft = a[i].scrollLeft; }
  return wrap;
}

export function disposeHandoff(h: Handoff): void {
  window.clearTimeout(h.guard);
  h.overlay.remove();
  if (pending === h) pending = null;
}

function stash(h: Handoff): true {
  if (pending) disposeHandoff(pending);
  pending = h;
  // if the next page never claims it (load error, other route), don't leave a ghost over the app
  h.guard = window.setTimeout(() => disposeHandoff(h), 5000);
  return true;
}

/** Zoom-in handoff: `source` is a miniature (MiniBoard root); `root` the page to snapshot.
 *  Returns false when there's nothing to match (the caller just navigates). */
export function prepareZoomIn(to: string, root: HTMLElement | null, source: HTMLElement | null): boolean {
  if (reduced() || !root || !source) return false;
  const fit = miniFitOf(source);
  if (!fit) return false;
  const r = source.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const from = toPage(fit.view, r);
  return stash({ kind: "in", to, overlay: snapshot(root), from, at: performance.now(), guard: 0 });
}

/** Zoom-out handoff: leaving `child` (its page `root`, drawn under view `cur` inside `vp`) for its parent. */
export function prepareZoomOut(parent: string, child: string, root: HTMLElement | null, vp: HTMLElement | null, cur: View): boolean {
  if (reduced() || !root || !vp) return false;
  const r = vp.getBoundingClientRect();
  return stash({ kind: "out", to: parent, child, overlay: snapshot(root), from: toPage(cur, r), at: performance.now(), guard: 0 });
}

/** The handoff waiting for board `bid`, if it is fresh. */
export function takeHandoff(bid: string): Handoff | null {
  const h = pending;
  if (!h) return null;
  if (h.to !== bid || performance.now() - h.at > 5000) return null;
  pending = null;
  window.clearTimeout(h.guard);
  return h;
}

const setOverlay = (h: Handoff, page: View, u: number) => {
  const child = h.overlay.firstElementChild as HTMLElement | null;
  if (child) child.style.transform = affineCss(matchTransform(h.from, page));
  h.overlay.style.opacity = String(leavingOpacity(u));
};

export interface ArriveIO {
  cam: Camera;
  /** the viewport element the camera drives (page origin) */
  vp: HTMLElement;
  /** the page root, faded in as the overlay fades out */
  root: HTMLElement;
  /** the view the camera should settle on */
  target: View;
}

/** "in": start the board under the miniature's view and fly to `target` while the old page dissolves. */
export function arriveZoomIn(h: Handoff, io: ArriveIO, setStart: (v: View) => void): Promise<boolean> {
  const o = io.vp.getBoundingClientRect();
  const start = fromPage(h.from, o);
  io.root.style.opacity = "0";
  setStart(start);
  setOverlay(h, h.from, 0);
  return io.cam.flyTo(io.target, {
    duration: ZOOM_IN_MS, ease: ZOOM_EASE,
    onFrame: (u, v) => {
      setOverlay(h, toPage(v, io.vp.getBoundingClientRect()), u);
      io.root.style.opacity = String(arrivingOpacity(u));
    },
  }).then((ok) => { io.root.style.opacity = ""; disposeHandoff(h); return ok; });
}

/** "out": the parent is already at its own view; shrink the old page into the card `find()` returns.
 *  The card's miniature loads after the page does, so wait for it (briefly) while the old page holds. */
export async function arriveZoomOut(h: Handoff, find: () => HTMLElement | null, size: Size): Promise<boolean> {
  let source: HTMLElement | null = null;
  let fit = null as ReturnType<typeof miniFitOf>;
  for (let i = 0; i < 25 && !fit; i++) {
    source = find();
    fit = miniFitOf(source);
    if (!fit) await new Promise((r) => window.setTimeout(r, 40));
  }
  const r = source?.getBoundingClientRect();
  if (!fit || !r || !r.width || r.bottom < 0 || r.top > size.h || r.right < 0 || r.left > size.w) {
    // no card on screen to land on: a plain dissolve
    h.overlay.style.transition = "opacity .26s ease-out";
    h.overlay.style.opacity = "0";
    return new Promise((res) => window.setTimeout(() => { disposeHandoff(h); res(true); }, 280));
  }
  const dest = toPage(fit.view, r);
  let v = h.from;
  const cam = new Camera({ get: () => v, set: (n) => { v = n; }, size: () => size });
  return cam.flyTo(dest, {
    duration: ZOOM_OUT_MS, ease: ZOOM_EASE,
    onFrame: (u, cur) => setOverlay(h, cur, u),
  }).then((ok) => { disposeHandoff(h); return ok; });
}
