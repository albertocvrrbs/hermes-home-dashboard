// REST client for the board backend (dashboard/plugin_api.py, /api/plugins/home-dashboard/boards).
import { fetchJSON } from "../sdk";
import type { LiveActionInfo } from "./live";
import type { BoardDoc, Entry, Op, Presence } from "./model";

const BASE = "/api/plugins/home-dashboard/boards";

export interface BoardRow {
  id: string; name: string; parent: string | null; updated: number; count: number;
  session: { id: string; profile: string } | null; seq: number;
}

export interface SinceResult { seq: number; hermes?: Presence; entries?: Entry[]; doc?: BoardDoc }

export interface VideoPoster { st: "ok" | "fail" | "none"; img?: string; dur?: number; iw?: number; ih?: number; by?: string; reason?: string }
export interface ActionResult { ok: boolean; code: number | string; out: string; ms: number; action: string }

export interface LinkPreview {
  kind: "link" | "image" | "video"; st: "ok" | "fail"; title?: string; desc?: string; site?: string;
  icon?: string; img?: string; asset?: string; iw?: number; ih?: number; video?: { p: string; id: string; vert?: boolean };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const boardsApi = {
  list: () => fetchJSON<{ boards: BoardRow[] }>(BASE).then((r) => r.boards),
  create: (name: string, parent: string | null = null) =>
    fetchJSON<{ board: BoardDoc }>(BASE, json("POST", { name, parent })).then((r) => r.board),
  since: (bid: string, seq = -1) => fetchJSON<SinceResult>(`${BASE}/${bid}?since=${seq}`),
  ops: (bid: string, ops: Op[], note?: string) =>
    fetchJSON<{ seq: number; entry: Entry & { noop?: boolean } }>(`${BASE}/${bid}/ops`, json("POST", { ops, note: note ?? null })),
  undo: (bid: string, s: number) =>
    fetchJSON<{ seq: number; entry: Entry & { noop?: boolean } }>(`${BASE}/${bid}/undo`, json("POST", { s })),
  remove: (bid: string) => fetchJSON<{ ok: boolean }>(`${BASE}/${bid}`, json("DELETE")),
  uploadImage: (data: string) =>
    fetchJSON<{ asset: string; iw?: number; ih?: number }>(`${BASE}/assets`, json("POST", { data })),
  uploadHtml: (html: string) => fetchJSON<{ asset: string }>(`${BASE}/assets`, json("POST", { html })),
  asset: (aid: string) => fetchJSON<{ mime: string; data?: string; text?: string }>(`${BASE}/assets/${aid}`),
  preview: (url: string) =>
    fetchJSON<{ preview: LinkPreview }>(`${BASE}/link-preview`, json("POST", { url })).then((r) => r.preview),
  poster: (ref: { src?: string; asset?: string }) =>
    fetchJSON<{ poster: VideoPoster }>(`${BASE}/video-poster`, json("POST", ref)).then((r) => r.poster),
  posterFromClient: (ref: { src?: string; asset?: string }, data: string, dur?: number) =>
    fetchJSON<{ poster: VideoPoster }>(`${BASE}/video-poster`, json("PUT", { ...ref, data, dur: dur ?? null })).then((r) => r.poster),
  videoChunk: (upload: string, i: number, n: number, data: string) =>
    fetchJSON<{ next?: number; asset?: string } & Partial<VideoPoster>>(`${BASE}/assets/video`, json("POST", { upload, i, n, data })),
  media: (aid: string, off: number, n: number) =>
    fetchJSON<{ mime: string; size: number; off: number; data: string }>(`${BASE}/media/${aid}?off=${off}&n=${n}`),
  liveActions: () => fetchJSON<{ actions: LiveActionInfo[]; problems: string[]; dir: string }>(`${BASE}/live/actions`),
  liveAction: (bid: string, iid: string, action: string, index: number, confirm: boolean) =>
    fetchJSON<{ result: ActionResult }>(`${BASE}/${bid}/live/${iid}/action`, json("POST", { action, index, confirm })).then((r) => r.result),
};

// ── video: posters (cached per source), uploaded files as blob URLs, chunked upload ──

const posterCache = new Map<string, Promise<VideoPoster>>();

export function videoPoster(ref: { src?: string; asset?: string }): Promise<VideoPoster> {
  const key = ref.asset ? `a:${ref.asset}` : `u:${ref.src}`;
  let p = posterCache.get(key);
  if (!p) {
    p = boardsApi.poster(ref);
    p.catch(() => posterCache.delete(key));
    posterCache.set(key, p);
  }
  return p;
}

export function rememberPoster(ref: { src?: string; asset?: string }, poster: VideoPoster): void {
  posterCache.set(ref.asset ? `a:${ref.asset}` : `u:${ref.src}`, Promise.resolve(poster));
}

const mediaCache = new Map<string, Promise<string>>();
const RANGE = 4 * 1024 * 1024;

/** An uploaded video as a blob URL (the hosts' fetch speaks JSON, so it arrives in ranges). */
export function mediaUrl(aid: string): Promise<string> {
  let p = mediaCache.get(aid);
  if (!p) {
    p = (async () => {
      const parts: Blob[] = [];
      let off = 0, size = Infinity, mime = "video/mp4";
      while (off < size) {
        const r = await boardsApi.media(aid, off, RANGE);
        size = r.size;
        mime = r.mime;
        if (!r.data) break;
        parts.push(b64ToBlob(r.data, r.mime));
        off += parts[parts.length - 1].size;
      }
      return URL.createObjectURL(new Blob(parts, { type: mime }));
    })();
    p.catch(() => mediaCache.delete(aid));
    mediaCache.set(aid, p);
  }
  return p;
}

export const VIDEO_TYPES = /^video\/(mp4|webm|quicktime)$/;
export const MAX_VIDEO = 100 * 1024 * 1024;
const CHUNK = 3 * 1024 * 1024;

/** Uploads a video file in chunks; the server answers with the asset and its poster. */
export async function uploadVideo(file: File, onProgress?: (f: number) => void): Promise<{ asset: string } & Partial<VideoPoster>> {
  if (!VIDEO_TYPES.test(file.type)) throw new Error("unsupported video type");
  if (file.size > MAX_VIDEO) throw new Error("video is over 100 MB");
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const upload = [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const n = Math.max(1, Math.ceil(file.size / CHUNK));
  for (let i = 0; i < n; i++) {
    const data = await blobToB64(file.slice(i * CHUNK, (i + 1) * CHUNK));
    const r = await boardsApi.videoChunk(upload, i, n, data);
    onProgress?.((i + 1) / n);
    if (r.asset) return r as { asset: string } & Partial<VideoPoster>;
  }
  throw new Error("upload did not finish");
}

/** Client fallback: seek a <video preload=metadata> and draw one frame to a canvas. */
export function grabFrame(src: string): Promise<{ data: string; dur: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    const done = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 15000);
    const cleanup = () => { clearTimeout(done); v.removeAttribute("src"); v.load(); };
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      v.currentTime = d > 0 && d < 10 ? d * 0.1 : Math.min(1, d || 1);
    };
    v.onseeked = () => {
      try {
        const w = Math.min(960, v.videoWidth || 640), h = Math.round(w * ((v.videoHeight || 360) / (v.videoWidth || 640)));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(v, 0, 0, w, h);
        const data = c.toDataURL("image/jpeg", 0.82).split(",", 2)[1] ?? "";
        const dur = Number.isFinite(v.duration) ? v.duration : 0;
        cleanup();
        if (!data) reject(new Error("empty frame")); else resolve({ data, dur });
      } catch (e) { cleanup(); reject(e); }
    };
    v.onerror = () => { cleanup(); reject(new Error("video failed to load")); };
    v.src = src;
  });
}

// ── asset cache: blob URLs for images, text for HTML ──────────────────────

const imageCache = new Map<string, Promise<string>>();
const htmlCache = new Map<string, Promise<string>>();

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function assetUrl(aid: string): Promise<string> {
  let p = imageCache.get(aid);
  if (!p) {
    p = boardsApi.asset(aid).then((r) => {
      if (!r.data) throw new Error("not an image");
      return URL.createObjectURL(b64ToBlob(r.data, r.mime));
    });
    p.catch(() => imageCache.delete(aid));
    imageCache.set(aid, p);
  }
  return p;
}

/** Open (pdf) or save (3D model) the original of an imported file. Not cached: these can be big. */
export async function openAsset(aid: string, name: string): Promise<void> {
  const r = await boardsApi.asset(aid);
  if (!r.data) throw new Error("not a file");
  const url = URL.createObjectURL(b64ToBlob(r.data, r.mime));
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  if (r.mime === "application/pdf") a.target = "_blank";
  else a.download = `${name.replace(/[\\/:*?"<>|]+/g, "_") || "model"}.${aid.split(".")[1] ?? "bin"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function assetHtml(aid: string): Promise<string> {
  let p = htmlCache.get(aid);
  if (!p) {
    p = boardsApi.asset(aid).then((r) => r.text ?? "");
    p.catch(() => htmlCache.delete(aid));
    htmlCache.set(aid, p);
  }
  return p;
}

// ── image upload: downscale anything over 2560 px or 3 MB before sending ──

const MAX_SIDE = 2560;
const MAX_BYTES = 3 * 1024 * 1024;

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function prepareImage(file: Blob): Promise<{ data: string; w: number; h: number }> {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("unsupported image type");
  const bmp = await createImageBitmap(file);
  let { width: w, height: h } = bmp;
  const animated = file.type === "image/gif";
  if (!animated && (w > MAX_SIDE || h > MAX_SIDE || file.size > MAX_BYTES)) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * s);
    h = Math.round(h * s);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    let blob: Blob | null = null;
    for (const q of [0.9, 0.82, 0.7, 0.55]) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", q));
      if (blob && blob.size <= MAX_BYTES) break;
    }
    if (!blob) throw new Error("could not encode image");
    bmp.close();
    return { data: await blobToB64(blob), w, h };
  }
  bmp.close();
  if (file.size > 5 * 1024 * 1024) throw new Error("image too large");
  return { data: await blobToB64(file), w, h };
}
