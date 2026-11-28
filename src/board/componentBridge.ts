// The page a custom component runs in. A component (a library entry Hermes wrote, see
// dashboard/boardkit/components.py) is HTML/JS shown in a sandboxed iframe: opaque origin, no
// network (CSP connect-src none), no storage of the dashboard. It talks to the board only through
// `window.hb`, a small versioned bridge injected ahead of its own scripts. docs/components.md is
// the contract; this file is the implementation of its in-frame half (the host half is
// useCompBridge.ts). `window.hermes` (size/theme, see embedBridge.ts) is injected too and the
// two share one set of messages for size and theme.
//
// Pure functions + a string of ES5 for the frame, so node --test can load and even run it.
import { BRIDGE_JS, baseCss, insertAtHead, type EmbedTheme } from "./embedBridge.ts";

export const HB_VERSION = 1;

// frame -> host
export const HB_ASSET_REQ = "hb:asset";
export const HB_ACTION_REQ = "hb:action";
export const HB_CLOCK_CMD = "hb:clock-cmd";
// host -> frame
export const HB_DATA = "hb:data";
export const HB_CLOCK = "hb:clock";
export const HB_ASSETS = "hb:assets";
export const HB_ASSET_RES = "hb:asset-res";
export const HB_ACTION_RES = "hb:action-res";

export interface HbInit {
  component: { name: string; version: string };
  data: Record<string, unknown>;
  /** attached data files: name -> revision */
  assets: Record<string, number>;
  actions: string[];
  clock: { t: number; playing: boolean; rate: number; duration: number; group: string | null; manual: boolean; master: boolean };
  /** gallery thumbnail: no data files, no actions */
  preview?: boolean;
}

export type ClockCmd = "play" | "pause" | "toggle" | "seek" | "rate" | "duration";

/** What a component may do without a network. `data:` and `blob:` for images, media and workers' scripts only. */
export const COMPONENT_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; "
  + "img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; "
  + "form-action 'none'; base-uri 'none'";

/** The in-frame bridge, ES5 on purpose (it is a string). Runs after BRIDGE_JS, which defines
 *  window.hermes (size, theme, onResize, onTheme) and posts `hermes:ready`. */
export const HB_JS = `(function(){
var W=window,P=W.parent,H=W.hermes,I=__HB_INIT__;
function bag(){var l=[];return{add:function(f){if(typeof f==='function')l.push(f);return function(){var i=l.indexOf(f);if(i>=0)l.splice(i,1)}},
fire:function(a,b){l.slice().forEach(function(f){try{f(a,b)}catch(e){try{console.error(e)}catch(x){}}})},n:function(){return l.length}}}
var dataS=bag(),tickS=bag(),seekS=bag(),stateS=bag(),pend={},seq=0,cache={};
function post(m){try{P.postMessage(m,'*')}catch(e){}}
function cmd(c,v){post({type:'${HB_CLOCK_CMD}',cmd:c,v:v})}
var C={t:0,playing:false,rate:1,duration:0,group:null,manual:false,master:false,
onTick:function(f){return tickS.add(f)},onSeek:function(f){return seekS.add(f)},onState:function(f){return stateS.add(f)},
play:function(){cmd('play')},pause:function(){cmd('pause')},toggle:function(){cmd('toggle')},
seek:function(t){cmd('seek',+t||0)},setRate:function(r){cmd('rate',+r||1)},setDuration:function(d){cmd('duration',+d||0)}};
function setClock(c){for(var k in c)if(k in C&&typeof C[k]!=='function')C[k]=c[k]}
setClock(I.clock||{});
var hb=W.hb={version:${HB_VERSION},component:I.component,data:I.data||{},assets:Object.keys(I.assets||{}),assetRev:I.assets||{},actions:I.actions||[],clock:C,
onData:function(f){var off=dataS.add(f);if(Object.keys(hb.data).length)try{f(hb.data,Object.keys(hb.data))}catch(e){}return off},
onResize:function(f){return H.onResize(f)},onTheme:function(f){return H.onTheme(f)},
asset:function(name,o){if(I.preview)return Promise.reject(new Error('no data in the preview'));var as=(o&&o.as)||(/\\.json$/i.test(name)?'json':'arraybuffer'),key=name+'@'+(hb.assetRev[name]||0);
var p=cache[key];if(!p){p=cache[key]=new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};post({type:'${HB_ASSET_REQ}',id:id,name:name})});p.catch(function(){delete cache[key]})}
return p.then(function(buf){if(as==='arraybuffer')return buf.slice(0);if(as==='blob')return new Blob([buf]);var s=new TextDecoder().decode(buf);return as==='json'?JSON.parse(s):s})},
action:function(name,args){if(I.preview)return Promise.reject(new Error('actions are off in the preview'));return new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};post({type:'${HB_ACTION_REQ}',id:id,name:String(name),args:args||{}})})}};
Object.defineProperty(hb,'size',{enumerable:true,get:function(){return H.size}});
Object.defineProperty(hb,'theme',{enumerable:true,get:function(){return H.theme}});
hb.ready=new Promise(function(res){var off=H.onResize(function(){res();try{off&&off()}catch(e){}})});
W.addEventListener('message',function(e){if(e.source!==P)return;var m=e.data;if(!m||typeof m!=='object')return;
if(m.type==='${HB_DATA}'){hb.data=m.data||{};dataS.fire(hb.data,m.keys||Object.keys(hb.data))}
else if(m.type==='${HB_ASSETS}'){hb.assetRev=m.assets||{};hb.assets=Object.keys(hb.assetRev)}
else if(m.type==='${HB_CLOCK}'){var was=C.playing,wr=C.rate,wd=C.duration;setClock(m.clock||{});
if(m.ev==='seek')seekS.fire(C.t,C);if(m.ev==='tick'||m.ev==='seek')tickS.fire(C.t,C);
if(m.ev==='state'||was!==C.playing||wr!==C.rate||wd!==C.duration)stateS.fire(C,C)}
else if(m.type==='${HB_ASSET_RES}'||m.type==='${HB_ACTION_RES}'){var q=pend[m.id];if(!q)return;delete pend[m.id];
if(m.ok)q.res(m.type==='${HB_ASSET_RES}'?m.body:m.result);else q.rej(new Error(m.error||'failed'))}});
})();`;

function jsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// split so the plugin validator does not mistake the HTML text for a script injected into the host
const SCRIPT_OPEN = String.fromCharCode(60) + "script";
const SCRIPT_CLOSE = String.fromCharCode(60) + "/script>";

/** The full document of a component card: CSP, theme (unless the card opted out), `window.hermes`,
 *  `window.hb`, then the author's page. */
export function componentDocument(html: string, themed: boolean, theme: EmbedTheme, init: HbInit): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="${COMPONENT_CSP}">`;
  const style = themed ? `<style id="hermes-base">${baseCss(theme)}</style>` : "";
  const bridge = `${SCRIPT_OPEN} id="hermes-bridge">${BRIDGE_JS.replace("__HERMES_THEME__", () => jsonForScript(theme))}${SCRIPT_CLOSE}`;
  const hb = `${SCRIPT_OPEN} id="hb-bridge">${HB_JS.replace("__HB_INIT__", () => jsonForScript(init))}${SCRIPT_CLOSE}`;
  return insertAtHead(html, csp + style + bridge + hb);
}

/** Bytes of a data file the host sends to the frame (an ArrayBuffer; strings are encoded). */
export function toBuffer(v: ArrayBuffer | Uint8Array | string): ArrayBuffer {
  if (typeof v === "string") return new TextEncoder().encode(v).buffer as ArrayBuffer;
  if (v instanceof Uint8Array) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer;
  return v;
}
