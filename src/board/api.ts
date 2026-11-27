// REST client for the board backend (dashboard/plugin_api.py, /api/plugins/home-dashboard/boards).
import { fetchJSON } from "../sdk";
import type { BoardDoc, Entry, Op, Presence } from "./model";

const BASE = "/api/plugins/home-dashboard/boards";

export interface BoardRow {
  id: string; name: string; parent: string | null; updated: number; count: number;
  session: { id: string; profile: string } | null; seq: number;
}

export interface SinceResult { seq: number; hermes?: Presence; entries?: Entry[]; doc?: BoardDoc }

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
};

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
