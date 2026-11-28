// Low-res stand-ins for pictures, used when the board is zoomed out (see lod.ts). One small
// blob per source, made once; the full image stays untouched for when you zoom back in.
const cache = new Map<string, Promise<string | null>>();

export const THUMB_W = 240;

/** URL of a <= THUMB_W px wide copy of the image at `src` (a blob URL), or null when it can't be made. */
export function thumbUrl(src: string, width = THUMB_W): Promise<string | null> {
  let p = cache.get(src);
  if (!p) {
    p = (async () => {
      try {
        const blob = await (await fetch(src)).blob();
        const bmp = await createImageBitmap(blob);
        if (bmp.width <= width) { bmp.close(); return null; } // already small: the original is the thumbnail
        const h = Math.max(1, Math.round((bmp.height * width) / bmp.width));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { bmp.close(); return null; }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, width, h);
        bmp.close();
        const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.72));
        return out ? URL.createObjectURL(out) : null;
      } catch {
        return null;
      }
    })();
    cache.set(src, p);
  }
  return p;
}
