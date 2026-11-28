// Video stage shared by video cards and live-card media: a poster first (never autoplay),
// the player mounts on click. Posters come from the server (ffmpeg, cached beside the assets,
// filled in lazily for videos that predate it); when the server can't make one, the browser
// grabs a frame itself and stores it, and if even that is blocked (a cross-origin video
// without CORS) the stage shows the video element paused at ~1 s.
import { useEffect, useState, type CSSProperties } from "react";
import { assetUrl, boardsApi, grabFrame, mediaUrl, rememberPoster, videoPoster, type VideoPoster } from "./api";
import { Icon } from "./icons";
import type { ItemCtx } from "./items";
import { stageMode } from "./playAll";

const PLAY = <svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 10 6 0 12z" /></svg>;

/** 119.35 -> "1:59", 3725 -> "1:02:05". */
export function clockDuration(s: number | undefined): string {
  if (!s || !Number.isFinite(s) || s <= 0) return "";
  const t = Math.round(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

interface PosterState { url: string | null; dur?: number; live?: string }

/** Poster for a video: an explicit image (asset or URL) wins, then the server's, then fallbacks. */
export function useVideoPoster(src?: string, asset?: string, posterAsset?: string, posterUrl?: string, knownDur?: number): PosterState & { setDur: (d: number) => void } {
  const [st, setSt] = useState<PosterState>({ url: posterUrl ?? null, dur: knownDur });
  useEffect(() => {
    let live = true;
    setSt({ url: posterUrl ?? null, dur: knownDur });
    const set = (p: Partial<PosterState>) => { if (live) setSt((s) => ({ ...s, ...p })); };
    if (posterAsset) {
      assetUrl(posterAsset).then((u) => set({ url: u }), () => undefined);
      if (knownDur || (!src && !asset)) return () => { live = false; };
    }
    if (!src && !asset) return () => { live = false; };
    const ref = asset ? { asset } : { src };
    const fromPoster = (p: VideoPoster) => {
      if (p.dur) set({ dur: p.dur });
      if (p.st === "ok" && p.img && !posterAsset && !posterUrl) assetUrl(p.img).then((u) => set({ url: u }), () => undefined);
    };
    videoPoster(ref).then(async (p) => {
      if (p.st === "ok") { fromPoster(p); return; }
      if (posterAsset || posterUrl) return;
      // the server couldn't decode it: try a frame from the browser, then the paused element
      try {
        const url = asset ? await mediaUrl(asset) : src!;
        const f = await grabFrame(url);
        const saved = await boardsApi.posterFromClient(ref, f.data, f.dur);
        rememberPoster(ref, saved);
        fromPoster(saved);
      } catch {
        if (src) set({ live: src });
      }
    }, () => { if (src && !posterAsset && !posterUrl) set({ live: src }); });
    return () => { live = false; };
  }, [src, asset, posterAsset, posterUrl, knownDur]);
  return { ...st, setDur: (d: number) => setSt((s) => (s.dur ? s : { ...s, dur: d })) };
}

export function VideoStage({ playId, c, src, asset, posterAsset, posterUrl, dur, title, vert, syncGroup, wall, style }: {
  playId: string; c: ItemCtx; src?: string; asset?: string; posterAsset?: string; posterUrl?: string;
  dur?: number; title?: string; vert?: boolean; syncGroup?: string; style?: CSSProperties;
  /** "Play all videos" is on and this video takes part (muted, looping, no controls). */
  wall?: boolean;
}) {
  const poster = useVideoPoster(src, asset, posterAsset, posterUrl, dur);
  // a video in a sync group is mounted from the start: it is the playhead the other cards follow
  const synced = !!syncGroup && !!(src || asset);
  const mode = stageMode({ clicked: c.playing === playId, synced, wall: !!wall && !!(src || asset) });
  const playing = mode !== "none";
  const onWall = mode === "wall";
  const [vel, setVel] = useState<HTMLVideoElement | null>(null);
  const clock = syncGroup ? c.sync.clock(syncGroup) : null;
  useEffect(() => (vel && clock ? clock.attachVideo(vel) : undefined), [vel, clock]);
  const [blob, setBlob] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!playing || !asset || blob) return;
    let live = true;
    setLoading(true);
    mediaUrl(asset).then((u) => { if (live) { setBlob(u); setLoading(false); } }, () => live && setLoading(false));
    return () => { live = false; };
  }, [playing, asset, blob]);
  const playable = src || asset;
  const length = clockDuration(poster.dur);
  const url = asset ? blob : src;
  return (
    <div className={`stage${vert ? " vert" : ""}`} style={style}>
      {playing && url && (onWall
        ? <video className="wall" src={url} autoPlay muted loop playsInline preload="auto" title={title} poster={poster.url ?? undefined} />
        : <video ref={setVel} src={url} controls autoPlay={!synced} preload="metadata" data-nodrag="" title={title} poster={synced ? poster.url ?? undefined : undefined} />)}
      {synced && <span className="sync-chip over" data-tip={c.t("board.comp.syncTip", { group: syncGroup! })}><Icon name="sync" size={12} />{syncGroup}</span>}
      {!(playing && url) && (poster.url
        ? <img src={poster.url} alt="" draggable={false} />
        : poster.live
          ? <video className="still" src={`${poster.live}#t=1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true"
              onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) poster.setDur(d); }} />
          : <div className="poster-empty">{c.t("board.video.noPoster")}</div>)}
      {!(playing && url) && length && <span className="dur">{length}</span>}
      {!(playing && url) && playable && (
        <button className="play" data-nodrag="" onClick={() => c.setPlaying(playId)} disabled={loading}>
          {PLAY}{loading ? c.t("board.video.loading") : c.t("board.video.play")}
        </button>
      )}
    </div>
  );
}
