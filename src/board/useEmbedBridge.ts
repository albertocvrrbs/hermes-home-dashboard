// DOM half of the embed bridge: reads the board's theme, tells the iframe how big its card is
// (and how zoomed the board is), and relays live theme changes. See embedBridge.ts for the modes.
import { useEffect, useRef, type RefObject } from "react";
import { makeTheme, sizeMessage, READY_MSG, SIZE_MSG, THEME_MSG, type EmbedTheme, type RawTheme } from "./embedBridge";

function normalise(ctx: CanvasRenderingContext2D | null, css: string, fallback: string): string {
  if (!ctx) return css || fallback;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return d[3] === 255 ? `rgb(${d[0]} ${d[1]} ${d[2]})` : `rgb(${d[0]} ${d[1]} ${d[2]} / ${Math.round((d[3] / 255) * 100) / 100})`;
}

/** Resolve the board's own variables to concrete colours/fonts (custom properties are not resolved
 *  by getComputedStyle, so each goes through a probe element). */
export function readTheme(at: HTMLElement): EmbedTheme {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  at.appendChild(probe);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const colour = (value: string, fallback: string) => {
    probe.style.color = "";
    probe.style.color = value;
    return normalise(ctx, getComputedStyle(probe).color, fallback);
  };
  const font = (value: string, fallback: string) => {
    probe.style.fontFamily = value;
    return getComputedStyle(probe).fontFamily || fallback;
  };
  const raw: RawTheme = {
    foreground: colour("var(--ink)", "rgb(243 236 227)"),
    mutedForeground: colour("var(--ink-3)", "rgb(160 155 150)"),
    accent: colour("var(--accent)", "rgb(255 227 196)"),
    border: colour("color-mix(in srgb, var(--ink) 14%, transparent)", "rgb(255 255 255 / 0.14)"),
    card: colour("var(--sheet)", "rgb(20 30 30)"),
    background: colour("var(--bg)", "rgb(3 25 25)"),
    fontSans: font("var(--sans)", "system-ui, sans-serif"),
    fontMono: font("var(--mono)", "ui-monospace, monospace"),
  };
  probe.remove();
  return makeTheme(raw);
}

/** `box` wraps the iframe. Themed embeds get the theme pushed on ready and whenever the page's
 *  look changes; every embed (themed or not) gets `hermes:size` on load, on card resize, and once
 *  the board's zoom has settled. */
export function useEmbedBridge(box: RefObject<HTMLElement | null>, active: boolean, themed: boolean, key: string,
  onTheme?: (t: EmbedTheme) => void) {
  const theme = useRef<EmbedTheme | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !active) return;
    const win = () => el.querySelector("iframe")?.contentWindow ?? null;
    const post = (m: unknown) => { try { win()?.postMessage(m, "*"); } catch { /* frame gone */ } };
    let lastSize = "";
    const size = (force = false) => {
      const r = el.getBoundingClientRect();
      const zoom = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const m = sizeMessage(el.clientWidth, el.clientHeight, window.devicePixelRatio, zoom);
      const sig = `${m.w}x${m.h}@${m.dpr}`;
      if (force || sig !== lastSize) { lastSize = sig; post(m); }
    };
    const sendTheme = () => {
      if (!themed) return;
      const t = readTheme(el);
      if (JSON.stringify(t) === JSON.stringify(theme.current)) return;
      theme.current = t;
      onTheme?.(t);
      post({ type: THEME_MSG, theme: t });
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== win() || !e.data || e.data.type !== READY_MSG) return;
      theme.current = null; sendTheme(); size(true);
    };
    window.addEventListener("message", onMessage);
    let frame: HTMLIFrameElement | null = null;
    const hook = () => {
      const f = el.querySelector("iframe");
      if (f && f !== frame) { frame?.removeEventListener("load", onLoad); frame = f; f.addEventListener("load", onLoad); }
    };
    const onLoad = () => size(true);
    hook();
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const ro = RO ? new RO(() => { hook(); size(); }) : null;
    ro?.observe(el);
    // zoom is a CSS transform on the board, so it never resizes the card: poll it, cheaply, and let
    // the canvas re-rasterise only after it has held still for one tick (idle).
    let seen = "", settled = "", n = 0;
    const tick = window.setInterval(() => {
      hook();
      const r = el.getBoundingClientRect();
      const z = (el.offsetWidth ? r.width / el.offsetWidth : 1).toFixed(2);
      if (z === seen && z !== settled) { settled = z; size(); }
      seen = z;
      if (++n % 4 === 0) sendTheme();
    }, 450);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(sendTheme) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const first = window.setTimeout(() => { sendTheme(); size(true); }, 120);
    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", onLoad);
      ro?.disconnect(); mo?.disconnect();
      window.clearInterval(tick); window.clearTimeout(first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, active, themed, key]);
}

export { SIZE_MSG };
