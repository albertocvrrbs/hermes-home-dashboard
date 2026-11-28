// The Hermes emblem set. Each vector design is drawn in its own unit box with white "ink" on
// black (grey = partial ink, which the dither turns into texture); emblem-render.ts rasterises
// it at the widget's dot resolution. Strokes stay >= ~4 units so they survive ~70-dot grids;
// black strokes cut the gaps that separate feathers, scutes and straps.
import type { EmblemId } from "./ascii-presentation";

type G = CanvasRenderingContext2D;

export interface VectorEmblem {
  kind: "vector";
  /** Unit box (design coordinates). */
  w: number;
  h: number;
  /** Error diffusion for shaded pieces, ordered dither for flat ones. */
  dither: "fs" | "bayer";
  draw: (g: G) => void;
}
export interface BrailleEmblem { kind: "braille"; art: string }
export type Emblem = VectorEmblem | BrailleEmblem;

/** The official Hermes caduceus from hermes_cli/banner.py (HERMES_CADUCEUS), stripped of rich
 *  markup. Keep in sync if the banner art ever changes. */
export const OFFICIAL_CADUCEUS = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⡀⠀⣀⣀⠀⢀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣠⣴⣾⣿⣿⣇⠸⣿⣿⠇⣸⣿⣿⣷⣦⣄⡀⠀⠀⠀⠀⠀⠀
⠀⢀⣠⣴⣶⠿⠋⣩⡿⣿⡿⠻⣿⡇⢠⡄⢸⣿⠟⢿⣿⢿⣍⠙⠿⣶⣦⣄⡀⠀
⠀⠀⠉⠉⠁⠶⠟⠋⠀⠉⠀⢀⣈⣁⡈⢁⣈⣁⡀⠀⠉⠀⠙⠻⠶⠈⠉⠉⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⣿⡿⠛⢁⡈⠛⢿⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠿⣿⣦⣤⣈⠁⢠⣴⣿⠿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠻⢿⣿⣦⡉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢷⣦⣈⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣴⠦⠈⠙⠿⣦⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣤⡈⠁⢤⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠷⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⠑⢶⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠁⢰⡆⠈⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⠈⣡⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`;

// ── drawing helpers ──────────────────────────────────────────────────────

const ink = (v: number) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
const BLACK = "#000";
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A feather (or petal): rounded base at (x, y), widest at 35 %, pointed tip `len` along `deg`.
 *  Cut out of its neighbours with a black outline `gap` wide. */
function feather(g: G, x: number, y: number, deg: number, len: number, wid: number, shade: number, gap = 2.2, curl = 0) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const P = (u: number, v: number): [number, number] => [x + c * u - s * v, y + s * u + c * v];
  g.beginPath();
  g.moveTo(...P(0, -wid * 0.42));
  g.bezierCurveTo(...P(len * 0.3, -wid * 0.62), ...P(len * 0.75, -wid * 0.4 + curl), ...P(len, curl));
  g.bezierCurveTo(...P(len * 0.78, wid * 0.42 + curl), ...P(len * 0.3, wid * 0.6), ...P(0, wid * 0.42));
  g.arc(x, y, wid * 0.42, a + Math.PI / 2, a + Math.PI * 1.5);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = gap;
  g.strokeStyle = BLACK;
  g.stroke();
  const grad = g.createLinearGradient(...P(0, 0), ...P(len, 0));
  grad.addColorStop(0, ink(shade));
  grad.addColorStop(1, ink(shade * 0.9));
  g.fillStyle = grad;
  g.fill();
}

function ellipse(g: G, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function radial(g: G, x: number, y: number, r: number, inner: number, outer: number): CanvasGradient {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, ink(inner));
  grad.addColorStop(1, ink(outer));
  return grad;
}

function line(g: G, pts: [number, number][], w: number, color: string) {
  g.beginPath();
  g.moveTo(...pts[0]);
  for (const p of pts.slice(1)) g.lineTo(...p);
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = color;
  g.stroke();
}

// ── designs ──────────────────────────────────────────────────────────────

/** Kerykeion: the herald's staff, two snakes in a true double helix (painter-sorted so they
 *  pass over and under each other and the staff), wings sweeping out and down like the banner. */
function drawCaduceus(g: G) {
  const cx = 60;
  // wings first (behind the knob): rise from the staff, sweep out, tips droop like the banner's
  placeWing(g, cx - 4, 34, 0.44, -1, -4);
  placeWing(g, cx + 4, 34, 0.44, 1, -4);
  // helix: x = cx ± A sin θ, depth = cos θ. Each snake is cut into runs that stay on one side
  // of the staff (front or back); back runs, then the staff, then front runs, so the snakes pass
  // over and under each other. A run is outlined whole before it is filled, so it never cuts
  // into itself.
  const y0 = 44, y1 = 124, turns = 2;
  type Pt = { p: [number, number]; z: number; w: number };
  type Run = { front: boolean; pts: Pt[] };
  const runs: Run[] = [];
  const N = 160;
  for (const phase of [0, Math.PI]) {
    let run = null as Run | null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const th = phase + Math.PI / 2 + t * turns * Math.PI * 2;
      const A = 18 - 9 * t;
      const pt: Pt = { p: [cx + A * Math.sin(th), y0 + (y1 - y0) * t], z: Math.cos(th), w: 8 - 4.4 * t };
      const front = pt.z >= 0;
      if (!run || run.front !== front) {
        const prev: Pt | undefined = run ? run.pts[run.pts.length - 1] : undefined;
        run = { front, pts: prev ? [prev] : [] };
        runs.push(run);
      }
      run.pts.push(pt);
    }
  }
  const paintRun = (pts: Pt[], front: boolean) => {
    for (let i = 1; i < pts.length; i++) line(g, [pts[i - 1].p, pts[i].p], pts[i].w + 3.2, BLACK);
    for (let i = 1; i < pts.length; i++) {
      const z = pts[i].z;
      line(g, [pts[i - 1].p, pts[i].p], pts[i].w, ink(front ? 1 : 0.5 + 0.15 * (1 + z)));
    }
  };
  for (const r of runs) if (!r.front) paintRun(r.pts, false);
  // staff
  g.fillStyle = BLACK;
  g.fillRect(cx - 4, 20, 8, 112);
  const staff = g.createLinearGradient(cx - 3, 0, cx + 3, 0);
  staff.addColorStop(0, ink(0.7));
  staff.addColorStop(0.45, ink(1));
  staff.addColorStop(1, ink(0.75));
  g.fillStyle = staff;
  g.beginPath();
  g.moveTo(cx - 2.6, 20);
  g.lineTo(cx + 2.6, 20);
  g.lineTo(cx + 1.8, 128);
  g.lineTo(cx, 132);
  g.lineTo(cx - 1.8, 128);
  g.closePath();
  g.fill();
  for (const r of runs) if (r.front) paintRun(r.pts, true);
  // heads: at the top of each helix, facing each other across the staff
  for (const side of [-1, 1] as const) {
    const hx = cx + side * 18, hy = y0 - 1;
    g.save();
    g.translate(hx, hy);
    g.scale(-side, 1);
    g.beginPath();
    g.moveTo(-2, -4.6);
    g.bezierCurveTo(4, -6.2, 9, -3.4, 10.5, -0.6);
    g.bezierCurveTo(9.5, 2.2, 4, 3.8, -2, 4.2);
    g.closePath();
    g.lineWidth = 2.6;
    g.strokeStyle = BLACK;
    g.stroke();
    g.fillStyle = ink(1);
    g.fill();
    ellipse(g, 4.2, -1.4, 1.3, 1.1, BLACK);
    g.restore();
  }
  // knob
  ellipse(g, cx, 16, 7.6, 7.6, BLACK);
  ellipse(g, cx, 16, 6, 6, radial(g, cx - 2, 14, 8, 1, 0.6));
  ellipse(g, cx, 7.4, 3.2, 3, ink(0.9));
}

/** Talaria: Hermes' winged sandal, side view, toe to the right. */
function drawTalaria(g: G) {
  g.translate(12, -6);
  // the foot (lit), the sandal's straps cut into it as dark lacing
  g.beginPath();
  g.moveTo(31, 30);
  g.bezierCurveTo(31, 25, 52, 25, 52, 30);
  g.bezierCurveTo(52, 40, 55, 46, 66, 52);
  g.bezierCurveTo(80, 60, 100, 62, 113, 66);
  g.bezierCurveTo(119, 68, 119, 76, 112, 77);
  g.lineTo(28, 77);
  g.bezierCurveTo(22, 77, 22, 68, 26, 60);
  g.bezierCurveTo(29, 50, 31, 40, 31, 30);
  g.closePath();
  const foot = g.createLinearGradient(30, 26, 100, 76);
  foot.addColorStop(0, ink(1));
  foot.addColorStop(1, ink(0.97));
  g.fillStyle = foot;
  g.fill();
  g.save();
  g.clip();
  for (const [a, b] of [[[24, 38], [58, 36]], [[26, 58], [68, 66]], [[26, 70], [64, 54]],
    [[66, 54], [82, 78]], [[86, 59], [98, 78]]] as [number, number][][]) {
    line(g, [a, b], 3, BLACK);
  }
  g.restore();
  // sole: thick, toe lifts slightly
  g.beginPath();
  g.moveTo(22, 76);
  g.lineTo(112, 76);
  g.bezierCurveTo(121, 76, 123, 82, 116, 85);
  g.lineTo(26, 86);
  g.bezierCurveTo(18, 86, 17, 76, 22, 76);
  g.closePath();
  g.fillStyle = ink(1);
  g.fill();
  line(g, [[22, 76], [114, 76]], 2.6, BLACK);
  line(g, [[26, 81], [114, 81]], 1.6, BLACK);
  // heel wing: long primaries swept back and up (the wingfoot silhouette), coverts over the root
  for (let i = 4; i >= 0; i--) {
    feather(g, 31, 58 - i * 5, 180 + i * 7.5, 30 + i * 7, 9.4, 0.96, 2.6, -2.6);
  }
  for (let i = 0; i < 3; i++) feather(g, 33, 55 - i * 5.5, 184 + i * 9, 14, 10, 1, 2.4, -1);
  ellipse(g, 32, 51, 5, 8, ink(1));
}

/** Petasos: the round traveller's hat with a wide brim and a wing on each side, front view. */
function drawPetasos(g: G) {
  const cx = 60;
  placeWing(g, cx - 20, 52, 0.4, -1, -14);
  placeWing(g, cx + 20, 52, 0.4, 1, -14);
  // crown dome, lit from the upper left
  g.beginPath();
  g.ellipse(cx, 66, 28, 36, 0, Math.PI, 0);
  g.closePath();
  g.lineWidth = 3;
  g.strokeStyle = BLACK;
  g.stroke();
  const dome = g.createRadialGradient(cx - 10, 40, 2, cx, 56, 40);
  dome.addColorStop(0, ink(1));
  dome.addColorStop(0.55, ink(0.9));
  dome.addColorStop(1, ink(0.66));
  g.fillStyle = dome;
  g.fill();
  // hat band
  g.fillStyle = BLACK;
  g.fillRect(cx - 30, 58, 60, 8.5);
  g.fillStyle = ink(0.95);
  g.fillRect(cx - 28, 60.4, 56, 3.8);
  // brim: wide ellipse, top face lit, a black seam where the crown meets it
  ellipse(g, cx, 72, 58, 13, BLACK);
  const brim = g.createLinearGradient(0, 60, 0, 84);
  brim.addColorStop(0, ink(1));
  brim.addColorStop(1, ink(0.82));
  ellipse(g, cx, 72, 56, 11.2, brim);
  g.beginPath();
  g.ellipse(cx, 67.5, 29, 4.6, 0, 0, Math.PI);
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  g.stroke();
}

/** Chelys lyre: tortoise-shell sound box, two horn arms, a yoke and strings. */
function drawLyre(g: G) {
  const cx = 50;
  // arms (behind the shell)
  for (const side of [-1, 1] as const) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const u = 1 - t;
      // cubic: shell shoulder → out → up → curl inward at the top
      const p0 = [cx + side * 14, 92], p1 = [cx + side * 40, 76], p2 = [cx + side * 38, 30], p3 = [cx + side * 24, 14];
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    line(g, pts, 10, BLACK);
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      line(g, [pts[i - 1], pts[i]], 7.2 - 3 * t, ink(0.95 - 0.1 * t));
    }
    // horn tips curl outward
    line(g, [[cx + side * 24, 14], [cx + side * 29, 9], [cx + side * 33, 10]], 4, ink(1));
  }
  // yoke
  line(g, [[cx - 30, 24], [cx + 30, 24]], 8.4, BLACK);
  line(g, [[cx - 29, 24], [cx + 29, 24]], 5.2, ink(1));
  // sound box: a domed shell with scutes
  ellipse(g, cx, 100, 28, 20, BLACK);
  ellipse(g, cx, 100, 26, 18, radial(g, cx - 6, 94, 30, 1, 0.78));
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  for (const [x, y] of [[cx, 94], [cx - 13, 103], [cx + 13, 103], [cx, 108]]) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = rad(30 + k * 60);
      const px = x + Math.cos(a) * 7.2, py = y + Math.sin(a) * 6.2;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.stroke();
  }
  // strings: yoke to bridge
  for (let i = 0; i < 7; i++) {
    const x = cx - 12 + i * 4;
    line(g, [[x, 26], [x + (x - cx) * 0.15, 96]], 1.9, ink(1));
  }
  line(g, [[cx - 15, 96.5], [cx + 15, 96.5]], 4, BLACK);
  line(g, [[cx - 14, 96.5], [cx + 14, 96.5]], 2.4, ink(1));
}

/** The tortoise whose shell became the first lyre: top view, scutes in relief. */
function drawTortoise(g: G) {
  const cx = 55, cy = 54;
  // head, legs and tail under the shell
  ellipse(g, cx, 12, 8.5, 10.5, radial(g, cx - 2, 9, 12, 1, 0.7));
  ellipse(g, cx - 3.4, 9, 1.4, 1.6, BLACK);
  ellipse(g, cx + 3.4, 9, 1.4, 1.6, BLACK);
  for (const [sx, sy, rot] of [[-1, -1, -0.6], [1, -1, 0.6], [-1, 1, 0.7], [1, 1, -0.7]] as const) {
    ellipse(g, cx + sx * 31, cy + sy * 24, 9.5, 13, ink(0.85), rot);
    for (let k = -1; k <= 1; k++) {
      const a = Math.atan2(sy, sx) + k * 0.36;
      ellipse(g, cx + sx * 31 + Math.cos(a) * 11, cy + sy * 24 + Math.sin(a) * 12, 1.8, 1.8, BLACK);
    }
  }
  g.beginPath();
  g.moveTo(cx - 4, cy + 34);
  g.lineTo(cx, cy + 46);
  g.lineTo(cx + 4, cy + 34);
  g.fillStyle = ink(0.85);
  g.fill();
  // shell
  ellipse(g, cx, cy, 33, 38, BLACK);
  ellipse(g, cx, cy, 31, 36, radial(g, cx - 8, cy - 10, 44, 0.95, 0.55));
  // marginal ring
  g.beginPath();
  g.ellipse(cx, cy, 25.5, 30.5, 0, 0, Math.PI * 2);
  g.lineWidth = 2.2;
  g.strokeStyle = BLACK;
  g.stroke();
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    line(g, [[cx + Math.cos(a) * 25.5, cy + Math.sin(a) * 30.5], [cx + Math.cos(a) * 31.5, cy + Math.sin(a) * 36.5]], 1.6, BLACK);
  }
  // scutes: 3 vertebral down the middle, 2 costal per side, each domed
  const hex = (x: number, y: number, rx: number, ry: number) => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = rad(k * 60);
      const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.lineWidth = 2.4;
    g.strokeStyle = BLACK;
    g.fillStyle = radial(g, x - rx * 0.3, y - ry * 0.35, Math.max(rx, ry) * 1.3, 1, 0.62);
    g.fill();
    g.stroke();
  };
  for (const y of [cy - 18, cy, cy + 18]) hex(cx, y, 10.2, 9.4);
  for (const side of [-1, 1]) {
    hex(cx + side * 18.5, cy - 9, 8.6, 8.8);
    hex(cx + side * 18.5, cy + 9.5, 8.6, 8.8);
  }
}

/** Drachma: an ancient silver coin, beaded rim, Hermes in profile wearing the winged petasos.
 *  Flat relief (white on a black field) so the profile survives a ~45-dot head. */
function drawDrachma(g: G) {
  const cx = 50, cy = 50;
  // flan edge, slightly irregular like a struck coin
  g.beginPath();
  for (let k = 0; k <= 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const r = 46.5 + 1.1 * Math.sin(a * 3 + 0.6) + 0.7 * Math.sin(a * 5);
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (k) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  g.lineWidth = 2.6;
  g.strokeStyle = ink(0.9);
  g.stroke();
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    ellipse(g, cx + Math.cos(a) * 41, cy + Math.sin(a) * 41, 2.7, 2.7, ink(1));
  }
  // the head, facing right
  g.save();
  g.beginPath();
  g.arc(cx, cy, 37, 0, Math.PI * 2);
  g.clip();
  g.translate(cx + 1, cy + 3);
  g.scale(1.12, 1.12);
  g.translate(-55, -58);
  const head = new Path2D(
    "M36 88 C38 80 38 73 35 67 C31 61 30 51 34 44 L68 43 L70 47 L77.5 59 L72.6 60.6 L73.8 63 L71 64.3 " +
    "L72.8 66.5 L70 68.5 C72.2 71 71.6 74.4 68 75.6 C64.5 76.6 62 76.2 60.4 77.4 L61 88 Z",
  );
  g.lineJoin = "round";
  g.fillStyle = ink(1);
  g.fill(head);
  // eye, brow, ear, the truncation of the neck
  g.fillStyle = BLACK;
  g.beginPath();
  g.moveTo(62.6, 52.6);
  g.quadraticCurveTo(65.4, 50.4, 68, 52.4);
  g.quadraticCurveTo(65.2, 54, 62.6, 52.6);
  g.fill();
  line(g, [[61.6, 49.4], [68.4, 48.6]], 1.5, BLACK);
  g.beginPath();
  g.arc(47.5, 58, 3.6, rad(-60), rad(130));
  g.lineWidth = 1.8;
  g.strokeStyle = BLACK;
  g.stroke();
  line(g, [[36, 88], [61, 88]], 2, BLACK);
  // petasos: domed crown, brim, a small wing on the crown
  placeWing(g, 44, 34, 0.3, -1, -30);
  g.beginPath();
  g.ellipse(53, 42, 17, 15, 0, Math.PI, 0);
  g.closePath();
  g.lineWidth = 2.4;
  g.strokeStyle = BLACK;
  g.stroke();
  g.fillStyle = ink(1);
  g.fill();
  ellipse(g, 53, 43.4, 26.5, 5.2, BLACK);
  ellipse(g, 53, 43, 25, 3.6, ink(1));
  g.restore();
}

/** A spread wing in its own frame (root at (8, 82), wrist up top, tip to the right): small
 *  coverts along the leading edge, long flight feathers below. `k` scales the black gaps and
 *  the edge so a small, scaled-down wing keeps visible feather separations. */
function wingShape(g: G, k = 1) {
  const edge = (t: number): [number, number] => {
    const u = 1 - t;
    const p0 = [8, 82], p1 = [20, 12], p2 = [70, 2], p3 = [100, 24];
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };
  // flight feathers hang down and outward, longest toward the tip
  const n = 11;
  for (let i = n - 1; i >= 0; i--) {
    const t = 0.12 + (i / (n - 1)) * 0.86;
    const [x, y] = edge(t);
    feather(g, x, y + 6, 100 - t * 74, 24 + 22 * Math.sin(t * Math.PI * 0.62), 13, 0.9 - 0.12 * (1 - t), 2 * k, 2);
  }
  // secondary coverts
  for (let i = 9; i >= 0; i--) {
    const t = 0.08 + (i / 9) * 0.8;
    const [x, y] = edge(t);
    feather(g, x, y + 2, 96 - t * 80, 22 - 6 * t, 9.5, 0.96, 2.2 * k, 1);
  }
  // marginal coverts: small scales right on the edge
  for (let i = 14; i >= 0; i--) {
    const t = 0.04 + (i / 14) * 0.78;
    const [x, y] = edge(t);
    feather(g, x, y, 92 - t * 76, 10.5, 7.4, 1, 1.9 * k, 0);
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= 30; i++) pts.push(edge((i / 30) * 0.86));
  line(g, pts, 4.2 * Math.min(k, 1.6), ink(1));
}

/** Places `wingShape` with its root at (x, y), scaled by `s`, mirrored for side -1 and turned
 *  by `deg` (positive = clockwise). */
function placeWing(g: G, x: number, y: number, s: number, side: 1 | -1, deg: number) {
  g.save();
  g.translate(x, y);
  g.scale(side, 1);
  g.rotate(rad(deg));
  g.scale(s, s);
  g.translate(-8, -82);
  wingShape(g, Math.min(2.2, 0.7 / s));
  g.restore();
}

/** A single spread wing. */
function drawWing(g: G) {
  wingShape(g);
}

export const EMBLEMS: Record<EmblemId, Emblem> = {
  "caduceus": { kind: "braille", art: OFFICIAL_CADUCEUS },
  "winged-caduceus": { kind: "vector", w: 120, h: 134, dither: "fs", draw: drawCaduceus },
  "talaria": { kind: "vector", w: 136, h: 84, dither: "fs", draw: drawTalaria },
  "petasos": { kind: "vector", w: 120, h: 88, dither: "fs", draw: drawPetasos },
  "lyre": { kind: "vector", w: 100, h: 124, dither: "fs", draw: drawLyre },
  "tortoise": { kind: "vector", w: 110, h: 104, dither: "fs", draw: drawTortoise },
  "drachma": { kind: "vector", w: 100, h: 100, dither: "fs", draw: drawDrachma },
  "wing": { kind: "vector", w: 146, h: 112, dither: "fs", draw: drawWing },
};
