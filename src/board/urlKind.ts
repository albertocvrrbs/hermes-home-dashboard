// URL classification for pasted links. Same table as dashboard/boardkit/urls.py (both are
// tested against test/fixtures/url-cases.json), plus the player URL builder for video cards.
import type { VideoRef } from "./model";

export type UrlKind =
  | { kind: "video"; p: VideoRef["p"]; id: string; vert?: true }
  | { kind: "file-video" }
  | { kind: "image" }
  | { kind: "page" };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
  "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com", "mobile.x.com"]);
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

export function classifyUrl(raw: string): UrlKind | null {
  if (typeof raw !== "string") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) return null;
  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);

  if (YT_HOSTS.has(host)) {
    let id: string | null = null;
    let vert = false;
    if (segs[0] === "watch") id = u.searchParams.get("v");
    else if (segs.length >= 2 && ["shorts", "embed", "live", "v"].includes(segs[0])) {
      id = segs[1];
      vert = segs[0] === "shorts";
    }
    if (id && YT_ID.test(id)) return vert ? { kind: "video", p: "youtube", id, vert: true } : { kind: "video", p: "youtube", id };
  } else if (host === "youtu.be" || host === "www.youtu.be") {
    if (segs[0] && YT_ID.test(segs[0])) return { kind: "video", p: "youtube", id: segs[0] };
  } else if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const num = segs.find((s) => /^\d+$/.test(s));
    if (num && (host !== "player.vimeo.com" || segs[0] === "video")) return { kind: "video", p: "vimeo", id: num };
  } else if (host === "loom.com" || host === "www.loom.com") {
    if (segs.length >= 2 && (segs[0] === "share" || segs[0] === "embed") && /^[A-Za-z0-9]{8,64}$/.test(segs[1])) {
      return { kind: "video", p: "loom", id: segs[1] };
    }
  } else if (X_HOSTS.has(host)) {
    if (segs.length >= 3 && segs[1] === "status" && /^\d{1,25}$/.test(segs[2])) return { kind: "video", p: "x", id: segs[2] };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: "file-video" };
  if (IMAGE_EXT.test(u.pathname)) return { kind: "image" };
  return { kind: "page" };
}

const PLAYER_ID: Record<string, RegExp> = {
  youtube: YT_ID, vimeo: /^\d{1,20}$/, loom: /^[A-Za-z0-9]{8,64}$/, x: /^\d{1,25}$/,
};

/** Embed URL on the provider's fixed player origin, built from a validated id only. */
export function playerUrl(v: { p: string; id: string }): string | null {
  const re = PLAYER_ID[v.p];
  if (!re || !re.test(v.id)) return null;
  switch (v.p) {
    case "youtube": return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
    case "vimeo": return `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`;
    case "loom": return `https://www.loom.com/embed/${v.id}?autoplay=1`;
    case "x": return `https://platform.twitter.com/embed/Tweet.html?id=${v.id}&dnt=true&theme=dark`;
  }
  return null;
}

/** A clipboard/drop payload that is exactly one http(s) URL. */
export function extractUrl(text: string): string | null {
  const s = (text || "").trim();
  if (!s || /\s/.test(s) || s.length > 2048) return null;
  return classifyUrl(s) ? s : null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
