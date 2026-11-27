# Board — infinite canvas for the Home dashboard (design spec)

Status: approved for build, 2026-11-27. Target release: **1.8.0**.
Sources: `hd-canvas-plan/NOTAS.md` (17 numbered decisions, the requirements) and the approved
visual mockup `hd-canvas-plan/mockup-v2/` ("Mesa de despacho": `board.html`, `RESEARCH.md`).
Where this spec closes a section the notes left open, it says so ("default").

## 1. What it is

A Milanote-like infinite board inside the Home plugin. Alberto and Hermes work on the same
board: Alberto writes notes, to-dos, columns, links, images and freehand sketches; Hermes reads
the board, writes on it (cards, maps, diagrams with arrows, tidy-ups, summaries, embeds) through
an agent tool, and a visible **Hermes cursor** shows where he is working. Every board has its own
linked Hermes session; "Continue in session" moves between the two, and changes Alberto makes
between turns are reported to that session.

Out of scope for v1 (decision 5): Hermes drawing freehand, converting the board into tasks/cron.

## 2. Surfaces

| Surface | Desktop / Webapp (`desktop/plugin.js`) | Web dashboard (`dashboard/dist`) |
|---|---|---|
| Home widget "Board" | live preview of one board; click opens it | same |
| Full page | route `/boards` (board index) and `/boards?id=<id>` | in-plugin view, `#board=<id>` hash on the Home tab |
| Sidebar | nav row **Boards** (`codicon: "layout"`) → index | — (dashboard tab is fixed by the manifest) |
| Palette | "Open boards" | — |
| `hermes ›` prompt | sends the request to the linked session through the gateway RPC (`session.resume` / `session.create` + `prompt.submit`) without leaving the board | copies the prompt and opens the chat (no RPC door on the web) |

The Home widget replaces the **Agent** widget, which is removed (decision 1): `AgentWidget.tsx`,
`widgets/agent/*`, `theater.ts`, the theater overlay in `HomePage.tsx`, their i18n keys and the
registry entry go away. Saved layouts that still contain `agent` (or any unknown id) keep loading:
`parseLayout` drops widget ids the registry does not know, and the backend validator keeps
accepting any string id so an older client can still save.

## 3. Visual system (mockup-v2, binding)

Follow `mockup-v2/board.html` closely; the rules below are the ones code must not drift from.

- **One accent**: the theme primary (`--home-accent`). No second hue for Hermes, no gradients,
  no glow, no vignette, no coloured tags. `--warn` (amber) only for "due today".
- **Authorship by material**: Alberto = solid 1 px hairlines, solid ink arrows, Architects
  Daughter for sketches, no mark. Hermes = dot-matrix frame (2 px dots every 4 px), dotted
  arrows, pixel caduceus + `hermes` signature in Departure Mono, reverse-video `▚ HERMES` tag.
  The mark goes on the outermost thing Hermes made.
- **Type, four voices**: Atkinson Hyperlegible Next (card titles/body), JetBrains Mono (headers,
  meta, keys, status line), Departure Mono (Hermes only), Architects Daughter (sketch only).
  Fonts are subset to Latin and embedded as `data:` woff2 (works under the Webapp CSP
  `font-src 'self' data:` and needs no static route). All OFL; licenses shipped in `fonts/`.
- **Cards**: solid sheet, 1 px rule at 13 %, 3 px radius, no resting shadow; hover brightens
  the rule and shows the Home resize corner (no lift). Shadow only on what floats (dragged
  items, menus). Radii: chrome 0, panels 4, cards/buttons 3, checkboxes 2.
- **Selection**: accent hairline + print crop marks at the corners (they are the resize
  handles). Context bar above the selection with concrete verbs.
- **Columns**: faint track, Home header (`lead rule · TITLE · count · fading hairline`), no box
  in a box. **Frames**: four corner marks + label; Hermes frames dotted.
- **Connectors**: orthogonal with 6–8 px rounded elbows, square source port, solid triangular
  head. Alberto's solid, Hermes' dotted; a connector Hermes is drawing appears dot by dot.
- **Chrome**: flush title line on top (path `home / boards /`, board name, `HERMES is editing
  <x>` in reverse video while he is active, saved time + session in plain text, one primary
  button "Continue in session"); flush tmux-style **status line** at the bottom (tools by key
  `V select · H pan | N note · T to-do · L link · I image · C column · B board · E embed | A arrow ·
  D draw`, the `hermes ›` prompt with a concrete example, zoom − % + and `F fit`). Narrow
  windows keep only the keys; names appear on hover (decision 14).
- **Map**: dot-matrix minimap (LIFE widget idiom); Hermes' items brighter; his cursor an inverted cell.
- **Log**: Hermes reports a batch as one Home-log line (`11:04 hermes <note> · Z undo · open in
  session`), not a glass toast.
- **Motion**: only what changes — the Hermes cursor (with a ~1 s fading dot trail and a blinking
  block caret, the only loop), an item he places (short settle), a connector drawn dot by dot, the
  log line. `prefers-reduced-motion` turns all of it off.
- Zero high-severity tells from `RESEARCH.md` (no purple, no gradient, no stock glass cards, no
  "Ask AI"/sparkles/wand, no floating centred dock, no initials avatars).

## 4. Data model (compact by design — decision 8)

Storage root: `$HERMES_HOME/plugin-data/home-dashboard/boards/` (user data, outside the git
checkout, survives `hermes plugins update`).

```
boards/
  <bid>.json          board document (current state)
  <bid>.log.jsonl     append-only op log (one batch per line)
  <bid>.lock          flock(2) target serialising writers across processes
  assets/<sha16>.<ext>  content-addressed blobs: png|jpg|gif|webp|ico|html
  links/<sha16>.json  link-preview cache (7 days)
  renders/<bid>.png   last board_render output (overwritten)
  sessions.json       stored session id -> board id (reverse index)
```

Ids: board ids are 8 base36 chars (random); item ids are base36 of a per-board counter
(`"a"`, `"b"`, … `"1z"`), so an op naming an item costs 1–3 characters.

Board document:

```json
{"v":1,"id":"k3x9p2qa","name":"Launch","parent":null,"seq":42,"n":57,
 "session":{"id":"20261127_…","profile":"default"},"seen":40,
 "created":1764250000,"updated":1764253000,
 "hermes":{"at":1764253000,"act":"placing step 04","on":"d"},
 "items":{"a":{"k":"card","x":40,"y":118,"w":256,"text":"…","tags":["video"]}}}
```

`seq` = last applied batch; `seen` = last seq Hermes has seen (read or injected).
Item fields (all optional except `k`): `x y w h` (ints, world px), `by:"h"` (Hermes-authored),
`in` (column id when the item lives in a column; then no x/y), plus per kind:

| `k` | fields |
|---|---|
| `card` | `title`, `text` (plain, `**bold**` allowed), `tags[]`, `due` (ISO date) |
| `todo` | `title`, `items[] {t, done?, by?, due?}` |
| `col` | `title`, `kids[]` (ordered item ids) |
| `link` | `url`, `title`, `desc`, `site`, `icon` (asset), `img` (asset), `st` (`"wait"`/`"ok"`/`"fail"`), `video` `{p, id}` (provider + id) |
| `image` | `asset`, `cap`, `iw ih` (intrinsic size) — also used for pasted image URLs (fetched into an asset) |
| `embed` | `asset` (html), `title` |
| `video` | `src` (direct `.mp4/.webm/.mov` url) — provider videos are `link` items with `video` |
| `board` | `ref` (child board id) |
| `frame` | `title`, `note` (titled region; corner marks) |
| `box` | `title`, `sub`, `num` (diagram node) |
| `text` | `text`, `size` (`"h"` section heading or `"p"`) |
| `draw` | `d` (simplified stroke: `"x,y x,y …"` relative to `x,y`, ints), `sw` |
| `line` | `a`, `b` (item ids or `[x,y]`), `label` |

Strokes are simplified on the client with Ramer–Douglas–Peucker (ε = 1.5 px world) and
integer-rounded before they are sent: a typical stroke is ~20 points, not 300.

### Ops

One batch = `{ops:[…], note?}`. Ops:

- `{"op":"add","item":{…},"ref":"$x"}` → new id; later ops in the same batch may use `"$x"`
  wherever an id goes (`id`, `a`, `b`, `in`, `kids`). Adding with `in` appends to that column.
- `{"op":"set","id":"d","p":{…}}` — shallow patch; `null` deletes a field; `in` moves between
  columns / out to the canvas.
- `{"op":"del","id":"d"}` — also removes connectors attached to it and its column membership;
  deleting a column deletes its kids.
- `{"op":"board","p":{"name":…}}` — board metadata.

The server applies the batch atomically (all or nothing), computes the **inverse** batch,
bumps `seq` and appends `{"s":seq,"t":ts,"by":"u"|"h","ops":…,"inv":…,"note":…}` to the log.
Undo of any entry = apply its `inv` as a new batch (so undo is itself undoable, and "Z undo"
on Hermes' log line works across processes). The client keeps its own undo/redo stack of the
batches it sent (⌘Z / ⇧⌘Z), applying inverses the same way.

Limits (enforced server-side): 2 000 items per board, 200 ops per batch, 20 000 chars per text
field, 400 points per stroke, 400 boards. The log is compacted to the newest 2 000 entries.

Both the Python engine (authoritative) and a TS mirror (optimistic UI) implement the same op
semantics; both are unit-tested against the same cases.

## 5. Agent toolset (decisions 2, 5, 6)

Registered with `ctx.register_tool` in toolset `board` (on by default for new plugin toolsets),
declared in `plugin.yaml` `provides_tools`. Fast paths: one call reads only what changed, one
call writes a whole diagram.

- **`board_read(board?, since?, full?)`** — `board` is an id or a name (case-insensitive);
  omitted = the board linked to this session. Returns a compact outline, one line per item:
  `c card @40,118 256w "8-second loop…" #video` / `f line c→d` / `g box "Record demo" in=frame:e`.
  By default returns **only changes since Hermes last saw the board** (`seen`) plus a one-line
  header with counts; `full:true` returns the whole outline (bounded to ~12 k chars, longest
  texts clipped). Unknown board → list of boards. Creating: `board_read(board="New name",
  create=true)`. A read from an unlinked session links the board to that session if the board
  has none.
- **`board_apply(board, ops, note?)`** — batched ops (above). Items Hermes adds get `by:"h"`.
  Returns `{seq, ids:{"$x":"q"}}` plus warnings. `note` becomes Hermes' log line. Writes Hermes'
  presence (`hermes.at/act/on`) so the UI shows "HERMES is editing" and drives his cursor.
  Link items with only `url` are previewed in the background (same fetcher as the UI).
- **`board_render(board, region?)`** — rasterises a region (default: everything, or the bounds
  of the selection of item ids) with Pillow to `renders/<bid>.png` and returns the path, so
  Hermes can `vision_analyze` a sketch before turning it into a clean diagram
  ("boceto → diagrama"). Strokes, boxes, text and connectors are drawn; images are placed.

## 6. Session link (decisions 3, 4, 6)

- The board stores `session {id, profile}` (stored session id). It is set the first time a
  session reads or writes the board while the board has none, or when the user's board prompt
  creates a session. `sessions.json` maps session → board for the hook.
- **Continue in session**: linked → `host.openSession(id)` (web: `/chat?resume=`). Unlinked →
  `host.newChat()` with the draft `Let's work on my board "<name>" [board:<bid>]` (web: copy +
  open chat). The `[board:<bid>]` marker in a user message links an unlinked session on its
  first turn.
- **`pre_llm_call` hook** — for linked sessions only, when the board changed since `seen` by
  someone other than Hermes, injects a compact block (≤ 1 500 chars) before the turn:
  `[Board "Launch" (k3x9p2qa) — Alberto changed it since your last turn: + card q "pin it too";
  ~ moved c; ✓ todo h item 3; - deleted r. board_read for details.]` and advances `seen`.
  Unlinked sessions get nothing (zero cost). On the first turn of a linked session it also adds
  a one-line pointer to the board tools.

## 7. Live updates and the Hermes cursor

- Polling with an op cursor: `GET /boards/<bid>?since=<seq>` answers `{seq}` alone when nothing
  changed (one `stat` + small read), the new log entries when it can, or the full document when
  the cursor is older than the retained log. Cadence: 1.5 s while the board page is visible and
  Hermes is active (presence < 30 s), 3 s visible idle, paused when the tab is hidden; the Home
  widget preview polls every 10 s. `ctx.socket` is not used in v1 (no-op on remote OAuth
  gateways); the cursor-based endpoint is the single path.
- **Hermes cursor** is driven by Hermes' op stream: when new `by:"h"` entries arrive, the client
  queues their ops and moves the cursor to each target (new item position, moved item, connector
  midpoint) at ~280 ms per op, revealing items as it goes, with the action label (`adding card`,
  `connecting 03 → 04`, `placing step 04`) and a dot trail. When idle, the cursor parks next to
  the last edit and fades after 4 s. Presence `hermes.act` is shown in the title line.

## 8. Content features

- **Notes/cards, to-do lists** (check, add, reorder, segmented progress cells, one cell per item),
  **columns** (drag cards in/out, reorder), **frames**, **text headings**, **diagram boxes**,
  **connectors** (tool `A`: drag from an item to another or to empty space), **freehand** (tool
  `D`: pointer strokes, RDP-simplified), **nested boards** (tool `B` creates a child board, card
  shows a live dot preview, click opens; breadcrumb `home / boards / parent / child`).
- **Undo/redo** (⌘Z / ⇧⌘Z), delete (⌫), duplicate (⌘D), select-all, marquee select, multi-drag,
  arrow-key nudge, zoom to fit (`F`), pan with space-drag / middle button / wheel, zoom with
  ctrl/⌘-wheel and pinch.
- **Images**: paste or drop an image file. The client downscales anything over 2 560 px or 3 MB
  (canvas → WebP/JPEG), uploads base64 JSON (`POST /boards/assets`, ≤ 5 MB decoded). The server
  sniffs magic bytes (PNG, JPEG, GIF, WebP, ICO only — no SVG), stores content-addressed.
- **Embeds (HTML)**: `embed` items hold an HTML asset (≤ 512 KB). Rendered as a sandboxed frame
  with `allow-scripts` only, never `allow-same-origin`: on Desktop/Webapp through the SDK's
  `SandboxedFrame` with a `data:text/html` src (the Webapp routes it through its guest shell, so
  the page CSP does not bind it); on the web dashboard as `<iframe sandbox="allow-scripts"
  srcdoc>`. The card bar says `sandbox: scripts only, no network`.
- **Paste a link → rich card.** Any pasted/dropped URL becomes a `link` card immediately
  (skeleton: domain + URL + shimmer-free placeholder rule lines), then the backend fetches the
  preview: Open Graph, Twitter card, `<title>`, `<meta description>`, site name, favicon,
  `og:image`, and oEmbed (provider endpoint for known video hosts, otherwise discovered via
  `<link rel="alternate" type="application/json+oembed">`). `og:image` and the favicon are
  downloaded into assets so the board never hotlinks. Failure → clean fallback (domain + URL).
  Results are cached 7 days by URL. Hermes can add link cards (`{k:"link",url}`) the same way.
- **Video links → playable card.** URL classification (client and server, same table):
  YouTube (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`), Vimeo (`vimeo.com/<n>`,
  `player.vimeo.com/video/<n>`), Loom (`/share/<id>`, `/embed/<id>`), X/Twitter status URLs, and
  direct `.mp4/.webm/.mov` files. The card shows the poster (thumbnail asset) with a play
  button; the player mounts **only on click** (never many iframes at once; leaving the viewport
  or opening another video unmounts it). Players: `youtube-nocookie.com/embed/<id>`,
  `player.vimeo.com/video/<id>?dnt=1`, `loom.com/embed/<id>`,
  `platform.twitter.com/embed/Tweet.html?id=<id>&dnt=true&theme=dark`, in an iframe with
  `sandbox="allow-scripts allow-same-origin allow-presentation"` (same-origin only for these
  fixed third-party origins, so they keep their own storage and cannot reach ours),
  `allow="autoplay; fullscreen; picture-in-picture"`, `allowfullscreen`,
  `referrerpolicy="strict-origin-when-cross-origin"`. Direct files use `<video controls
  preload="metadata">`. Video cards resize keeping 16:9 (9:16 for Shorts). Image URLs
  (`.png/.jpg/.jpeg/.gif/.webp`) become image cards (fetched into an asset).

## 9. Backend REST (`/api/plugins/home-dashboard/…`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/boards` | list `{id,name,parent,updated,count,session}` |
| POST | `/boards` | create `{name, parent?}` |
| GET | `/boards/{bid}?since=` | document or delta (§7) |
| POST | `/boards/{bid}/ops` | apply a user batch `{ops, base?}` → `{seq, ids, entry}` |
| POST | `/boards/{bid}/undo` | apply the inverse of log entry `{s}` |
| DELETE | `/boards/{bid}` | delete board (moves files to `boards/.trash/`) |
| POST | `/boards/assets` | upload `{mime, data(base64)}` → `{asset}` |
| GET | `/boards/assets/{aid}` | `{mime, data}` (JSON because `ctx.rest` is JSON-only; the client turns it into a blob URL and caches it) |
| POST | `/boards/link-preview` | `{url}` → preview (cached) and assets |

`bid` must match `^[a-z0-9]{8}$`, `aid` `^[a-f0-9]{16}\.(png|jpg|gif|webp|ico|html)$`; paths are
built from validated ids only and checked to stay under the root (`resolve()` + parent check).

## 10. Security

- **SSRF guard** for every server-side fetch (link previews, og:image, favicon, oEmbed, image
  URLs): `http`/`https` only, no credentials in the URL, ports 80/443/8080/8443 or the scheme
  default; DNS resolved once and **every** address must be public (rejects private, loopback,
  link-local incl. 169.254.169.254, CGNAT 100.64/10, multicast, reserved, unspecified,
  IPv4-mapped/6to4 forms of those, ULA fc00::/7); the connection is pinned to the vetted address
  (no second DNS lookup → no rebinding), TLS still verifies the real hostname; redirects followed
  manually, max 3, each hop re-validated; 5 s overall deadline; body cap 1 MB for HTML (only
  `text/html`/`application/xhtml+xml` parsed for metadata), 512 KB for oEmbed JSON, 5 MB for
  images (magic-byte sniffed; SVG refused). `security.allow_private_urls` is not consulted: the
  board never fetches private addresses.
- **Uploads**: size caps before decode (base64 length) and after; magic-byte sniffing; stored
  under a hash name, never the client's filename; served as base64 JSON with the sniffed mime.
- **Path traversal**: ids validated by regex, files resolved and checked under the root.
- **Embeds**: opaque-origin sandbox (`allow-scripts` only); HTML never rendered in the app
  realm. Video players: fixed allow-list of origins built from parsed ids, never from the
  pasted URL string.
- **Text**: rendered as React text (no `dangerouslySetInnerHTML`); the `**bold**` subset is
  parsed into elements.
- **Agent input**: the same validation as REST (sizes, kinds, field types); unknown fields are
  dropped.
- Disclosed in the README: new agent tools, the `pre_llm_call` hook, file storage under
  `plugin-data/home-dashboard/boards/`, and outbound HTTP for link previews.

## 11. Performance

- Viewport culling: items outside the viewport (+ margin) are not rendered at zoom < 0.35 they
  render as plain blocks; iframes never mount until clicked; images use cached blob URLs.
- Pan/zoom write a single CSS transform; React re-renders only on document changes.
- Polling reads `seq` first; deltas are entries since the cursor.
- Agent: diff reads by default, batched writes, 1–3 char item ids, compact outline lines.
- Web dashboard bundle and Desktop bundle share the board code; fonts subset (~70 KB total).

## 12. Testing

- Python (`test/test_board_*.py`, stdlib unittest): op engine (add/set/del/refs/columns/cascade,
  inverse round-trip, atomic failure), log append/compaction, delta reads, diff summary for the
  hook, outline, path traversal and id validation, upload sniffing and caps, SSRF guard
  (address classes, redirect to private, too many redirects, size cap, non-HTML), OG/Twitter/
  oEmbed parsing, URL classification, layout migration on the server side.
- TS (`test/board-*.test.mjs`): op engine mirror, URL classification (same table), stroke
  simplification, connector routing, layout migration (`agent` dropped), i18n key parity.
- End to end: a real `hermes chat` process creates a board and adds cards + connectors in one
  batch; a REST edit is then reported by the hook in the next turn.
- Visual QA against mockup-v2 (board page + Home widget) with screenshots.
