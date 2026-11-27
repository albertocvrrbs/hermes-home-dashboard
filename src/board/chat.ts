// The board's chat: read the linked session's recent messages and send to it.
//
// Per surface:
// - Hermes Desktop / Webapp: reads with the gateway's `session.transcript` (never attaches, so
//   the session is not pulled into any pane) and sends with `session.resume` + `prompt.submit`.
// - Web dashboard: reads the public `/api/sessions/{id}/messages` route. The web dashboard
//   gives plugins no way to submit a turn, so sending copies the prompt and opens the session
//   ("Continue in session"); the panel says so.
import { fetchJSON, hostRpc, newChatWithDraft, openSession } from "../sdk";
import type { BoardDoc } from "./model";
import { toChatRows, type ChatRow, type RawRow } from "./chatRows";

export { boardPrompt, toChatRows, type ChatRow } from "./chatRows";

export type ChatMode = "live" | "handoff";

/** Live = this surface can send into the session from the panel. */
export function chatMode(): ChatMode {
  return hostRpc() ? "live" : "handoff";
}

/** Recent messages of the board's linked session, or null when it can't be read here. */
export async function readChat(doc: BoardDoc, limit = 60): Promise<ChatRow[] | null> {
  const sid = doc.session?.id;
  if (!sid) return [];
  const rpc = hostRpc();
  if (rpc) {
    try {
      const r = await rpc<{ rows?: RawRow[] }>("session.transcript", { session_id: sid, order: "latest", limit });
      return toChatRows(r?.rows ?? []);
    } catch {
      try {
        const profile = doc.session?.profile;
        const r = await rpc<{ rows?: RawRow[] }>("session.transcript", { session_id: sid, order: "latest", limit, profile });
        return toChatRows(r?.rows ?? []);
      } catch {
        return null;
      }
    }
  }
  try {
    const r = await fetchJSON<{ messages?: RawRow[] }>(`/api/sessions/${encodeURIComponent(sid)}/messages?limit=${limit}&order=latest&inline_images=false`);
    return toChatRows(r?.messages ?? []);
  } catch {
    return null;
  }
}

// Live gateway session per board, so each send doesn't resume again.
const liveSessions = new Map<string, string>();

/** Sends a prompt to the board's session. `sent` = submitted from here; `handoff` = the prompt
 *  was copied / drafted and the chat opened instead. */
export async function sendToSession(doc: BoardDoc, body: string): Promise<"sent" | "handoff"> {
  const rpc = hostRpc();
  if (rpc) {
    const submit = async (sid: string) => { await rpc("prompt.submit", { session_id: sid, text: body }); };
    try {
      let sid = liveSessions.get(doc.id);
      if (sid) {
        try { await submit(sid); return "sent"; } catch { liveSessions.delete(doc.id); sid = undefined; }
      }
      if (doc.session?.id) {
        const r = await rpc<{ session_id?: string }>("session.resume", { session_id: doc.session.id, omit_messages: true, lazy: true });
        sid = r?.session_id;
      } else {
        const r = await rpc<{ session_id?: string }>("session.create", {});
        sid = r?.session_id;
      }
      if (sid) {
        liveSessions.set(doc.id, sid);
        await submit(sid);
        return "sent";
      }
    } catch {
      // fall through to the hand-off
    }
  }
  if (doc.session?.id) {
    try { await navigator.clipboard?.writeText(body); } catch { /* insecure origin */ }
    openSession(doc.session.id);
  } else {
    await newChatWithDraft(body);
  }
  return "handoff";
}
