// HTML embeds. Two modes, chosen per card (`item.theme`):
//
//  - off (default; anything a user pastes): the document is passed through byte for byte. The
//    only thing the board does is size the iframe to its card and post `hermes:size` messages
//    ({w,h,dpr,zoom}) that a page may listen to if it wants; nothing is injected.
//  - on (HTML Hermes writes, or a card the user switched on): a theme block is injected ahead of
//    the author's own markup - CSS variables, the two fonts, a transparent page, zero margins -
//    plus a small bridge that keeps `window.hermes` current, re-fires `resize` with the card's
//    real size, and applies live theme changes. Charts (Chart.js / ECharts) get board defaults.
//
// Pure functions only here (tested in node); the DOM-reading half lives in `useEmbedBridge.ts`.

export interface EmbedTheme {
  scheme: "dark" | "light";
  foreground: string;
  mutedForeground: string;
  accent: string;
  border: string;
  card: string;
  background: string;
  fontSans: string;
  fontMono: string;
  /** five series colours derived from the accent */
  chart: string[];
}

export interface EmbedSize { w: number; h: number; dpr: number; zoom: number }

export const SIZE_MSG = "hermes:size";
export const THEME_MSG = "hermes:theme";
export const READY_MSG = "hermes:ready";

// ── colour maths ─────────────────────────────────────────────────────────

export function parseColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const n = parts.slice(0, 4).map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p)));
  if (n.some((v) => Number.isNaN(v))) return null;
  const ch = (i: number) => Math.max(0, Math.min(255, Math.round(parts[i].endsWith("%") ? n[i] * 255 : n[i])));
  return { r: ch(0), g: ch(1), b: ch(2), a: n[3] === undefined ? 1 : Math.max(0, Math.min(1, n[3])) };
}

export function luminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function toHsl({ r, g, b }: { r: number; g: number; b: number }): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Five distinguishable series colours: the accent first, then hue steps around it, with lightness
 *  and saturation pulled into a band that reads on the page (lighter on dark, deeper on light). */
export function chartPalette(accent: string, scheme: "dark" | "light"): string[] {
  const c = parseColor(accent) ?? { r: 255, g: 227, b: 196, a: 1 };
  const [h, s0, l0] = toHsl(c);
  const lo = scheme === "dark" ? 0.58 : 0.38, hi = scheme === "dark" ? 0.72 : 0.5;
  const s = Math.max(0.45, Math.min(0.8, s0));
  const out = [`#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`];
  [[150, 0], [45, 0.03], [-70, -0.02], [215, 0.02]].forEach(([dh, dl]) => {
    out.push(fromHsl((h + dh + 360) % 360, s, Math.max(lo, Math.min(hi, l0 + dl))));
  });
  return out;
}

export interface RawTheme {
  foreground: string; mutedForeground: string; accent: string; border: string; card: string;
  background: string; fontSans: string; fontMono: string;
}

export function makeTheme(raw: RawTheme): EmbedTheme {
  const bg = parseColor(raw.background);
  const scheme = bg && luminance(bg) > 0.5 ? "light" : "dark";
  return { ...raw, scheme, chart: chartPalette(raw.accent, scheme) };
}

// ── what the iframe receives ─────────────────────────────────────────────

export function themeVars(t: EmbedTheme): Record<string, string> {
  const v: Record<string, string> = {
    "--foreground": t.foreground, "--muted-foreground": t.mutedForeground, "--accent": t.accent,
    "--border": t.border, "--card": t.card, "--background": t.background,
    "--font-sans": t.fontSans, "--font-mono": t.fontMono,
  };
  t.chart.forEach((c, i) => { v[`--chart-${i + 1}`] = c; });
  return v;
}

/** Base stylesheet. Author styles come after it, so they win on equal specificity. */
export function baseCss(t: EmbedTheme): string {
  const vars = Object.entries(themeVars(t)).map(([k, v]) => `${k}:${v.replace(/[<>{};]/g, "")}`).join(";");
  return `:root{${vars};color-scheme:${t.scheme}}`
    + "*,*::before,*::after{box-sizing:border-box}"
    + "html,body{width:100%;height:100%;margin:0;background:transparent;color:var(--foreground);"
    + "font:13px/1.45 var(--font-sans);-webkit-font-smoothing:antialiased}"
    + "img,video,canvas,svg{max-width:100%}"
    + "code,pre,kbd,samp{font-family:var(--font-mono)}"
    + "*{scrollbar-width:thin;scrollbar-color:var(--border) transparent}";
}

/** The bridge runs before the author's scripts. ES5 on purpose: it is a string in the iframe. */
export const BRIDGE_JS = `(function(){
var W=window,D=document,P=W.parent,H=W.hermes={size:{w:0,h:0,dpr:W.devicePixelRatio||1,zoom:1},theme:__HERMES_THEME__,_r:[],_t:[]};
var VARS={foreground:'--foreground',mutedForeground:'--muted-foreground',accent:'--accent',border:'--border',card:'--card',background:'--background',fontSans:'--font-sans',fontMono:'--font-mono'};
function sub(list,f){list.push(f);return function(){var i=list.indexOf(f);if(i>=0)list.splice(i,1)}}
function call(list,v){list.slice().forEach(function(f){try{f(v)}catch(e){}})}
H.onResize=function(f){var u=sub(H._r,f);if(H.size.w)try{f(H.size)}catch(e){}return u};
H.onTheme=function(f){return sub(H._t,f)};
H.alpha=function(c,a){var m=/^#([0-9a-f]{6})$/i.exec(c);if(!m)return c;var n=parseInt(m[1],16);return'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'};
try{Object.defineProperty(W,'devicePixelRatio',{configurable:true,get:function(){return H.size.dpr}})}catch(e){}
function paint(t){var s=D.documentElement.style;for(var k in VARS)if(t[k])s.setProperty(VARS[k],t[k]);
(t.chart||[]).forEach(function(c,i){s.setProperty('--chart-'+(i+1),c)});s.colorScheme=t.scheme}
function chartJs(C){try{var d=C.defaults,t=H.theme;d.color=t.mutedForeground;d.borderColor=t.border;d.font.family=t.fontMono;
d.responsive=true;d.maintainAspectRatio=false;
if(!C.__hermes&&C.register){C.__hermes=1;C.register({id:'hermesPalette',beforeUpdate:function(ch){
var pal=H.theme.chart,type=ch.config.type,ds=ch.config.data.datasets||[];
ds.forEach(function(s,i){var c=pal[i%pal.length],many=type==='pie'||type==='doughnut'||type==='polarArea';
if(many){if(s.backgroundColor==null)s.backgroundColor=(s.data||[]).map(function(_,j){return pal[j%pal.length]});if(s.borderColor==null)s.borderColor='transparent'}
else{if(s.borderColor==null)s.borderColor=c;if(s.backgroundColor==null)s.backgroundColor=type==='line'||type==='radar'?H.alpha(c,.18):H.alpha(c,.8)}})}})}}catch(e){}}
function echarts(E){try{var t=H.theme,ax={axisLine:{lineStyle:{color:t.border}},axisTick:{lineStyle:{color:t.border}},splitLine:{lineStyle:{color:t.border}},axisLabel:{color:t.mutedForeground}};
E.registerTheme('hermes',{color:t.chart,backgroundColor:'transparent',textStyle:{color:t.mutedForeground,fontFamily:t.fontMono},
title:{textStyle:{color:t.foreground}},legend:{textStyle:{color:t.mutedForeground}},categoryAxis:ax,valueAxis:ax,logAxis:ax,timeAxis:ax,
tooltip:{backgroundColor:t.card,borderColor:t.border,textStyle:{color:t.foreground}}});
if(!E.__hermes){E.__hermes=1;var init=E.init;E.init=function(el,th,o){return init.call(E,el,th==null?'hermes':th,o)}}}catch(e){}}
H.chartDefaults=chartJs;
function trap(name,fn){var v;try{Object.defineProperty(W,name,{configurable:true,get:function(){return v},set:function(x){v=x;if(x)fn(x)}})}catch(e){}}
trap('Chart',chartJs);trap('echarts',echarts);
var raf=0;
function fire(){raf=0;var s=H.size,st=D.documentElement.style;st.setProperty('--card-w',s.w+'px');st.setProperty('--card-h',s.h+'px');
call(H._r,s);try{W.dispatchEvent(new Event('resize'))}catch(e){}}
W.addEventListener('message',function(e){if(e.source!==P)return;var m=e.data;if(!m||typeof m!=='object')return;
if(m.type==='${THEME_MSG}'&&m.theme){H.theme=m.theme;paint(m.theme);if(W.Chart&&W.Chart.defaults)chartJs(W.Chart);if(W.echarts)echarts(W.echarts);call(H._t,m.theme);
try{W.dispatchEvent(new Event('hermes:theme'))}catch(x){}}
else if(m.type==='${SIZE_MSG}'){H.size={w:m.w,h:m.h,dpr:m.dpr||1,zoom:m.zoom||1};if(!raf)raf=W.requestAnimationFrame(fire)}});
try{P.postMessage({type:'${READY_MSG}'},'*')}catch(e){}
})();`;

function jsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Put `block` at the very top of the document's <head> without breaking the doctype (quirks mode). */
export function insertAtHead(html: string, block: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + block + html.slice(head.index + head[0].length);
  const root = /<html(\s[^>]*)?>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + `<head>${block}</head>` + html.slice(root.index + root[0].length);
  const dt = /^\s*<!doctype[^>]*>/i.exec(html);
  if (dt) return dt[0] + block + html.slice(dt[0].length);
  return block + html;
}

/** The document an embed is shown as: untouched when the theme is off. */
export function embedDocument(html: string, themed: boolean, theme: EmbedTheme | null): string {
  if (!themed || !theme) return html;
  const block = `<style id="hermes-base">${baseCss(theme)}</style>`
    + `<script id="hermes-bridge">${BRIDGE_JS.replace("__HERMES_THEME__", () => jsonForScript(theme))}</script>`;
  return insertAtHead(html, block);
}

export function sizeMessage(w: number, h: number, devicePixelRatio: number, zoom: number) {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const dpr = Math.min(4, Math.round(Math.max(1, devicePixelRatio || 1) * Math.max(1, z) * 100) / 100);
  return { type: SIZE_MSG, w: Math.round(w), h: Math.round(h), dpr, zoom: Math.round(z * 100) / 100 };
}
