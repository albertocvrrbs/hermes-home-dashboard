// "Play all videos": every uploaded or direct video on the board plays at once, muted and looping,
// like a wall of monitors (a Training Room of 37 runs). Videos in a sync group are left alone (they
// already run on their group's clock) and so are external players (YouTube/Vimeo iframes), which
// cannot be muted or looped from here. Pure TypeScript, no React/DOM, so node --test loads it.
import type { Item } from "./model";

/** True for a video card the wall can play: an uploaded asset or a direct file, not in a sync group. */
export function wallPlayable(it: Item | undefined): boolean {
  if (!it || it.k !== "video") return false;
  if (it.sync) return false;
  return !!(it.asset || it.src);
}

/** Ids of the videos "Play all" starts, in board order. */
export function wallVideos(items: Record<string, Item>): string[] {
  return Object.keys(items).filter((id) => wallPlayable(items[id]));
}

/** The toolbar offers "Play all" only when there is more than one video to play. */
export function offersPlayAll(items: Record<string, Item>): boolean {
  return wallVideos(items).length > 1;
}

/** How a video stage mounts its player: the one the user clicked keeps its controls and sound;
 *  wall players are muted, looping and without controls; a synced video follows its clock. */
export function stageMode(o: { clicked: boolean; synced: boolean; wall: boolean }): "none" | "single" | "synced" | "wall" {
  if (o.synced) return "synced";
  if (o.clicked) return "single";
  if (o.wall) return "wall";
  return "none";
}
