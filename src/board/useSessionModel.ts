// The board's session model, per surface:
// - Hermes Desktop / Webapp: the live choice of the linked session (lazy `session.resume`, then
//   `session.info` events), and a controller that switches it like a chat tile does:
//   `config.set model "<model> --provider <p> --session"`, plus `reasoning` / `fast` for the row
//   options. The menu is Desktop's own (host.modelMenu.Picker).
// - Web dashboard: read-only, from the stored session row (`GET /api/sessions/{id}`); the web
//   dashboard gives plugins no session RPC to switch with.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJSON, hostModelMenu, hostRpc, onGatewayEvent, type BoardModelController } from "../sdk";
import { dropLiveSession, liveSession } from "./chat";
import type { BoardDoc } from "./model";
import {
  NO_MODEL, mergeSessionInfo, modelFromSessionRow, modelSwitchValue, readPresets, presetKey, speedValue, writePreset,
  type ModelPreset, type SessionModel,
} from "./sessionModel";

interface SwitchResult { confirm_required?: boolean; confirm_message?: string; deferred?: boolean; value?: string }

const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export interface SessionModelState {
  model: SessionModel;
  /** Runtime id of the live session (Desktop), null on the web dashboard / before resume. */
  sid: string | null;
  /** Null when this surface can't switch (web dashboard, older Desktop, no session). */
  controller: BoardModelController | null;
  /** A switch is in flight. */
  busy: boolean;
}

export function useSessionModel(doc: BoardDoc, opts: { refreshKey?: number; failureMessage: string }): SessionModelState {
  const storedId = doc.session?.id ?? null;
  const [model, setModel] = useState<SessionModel>(NO_MODEL);
  const [sid, setSid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const modelRef = useRef(model);
  modelRef.current = model;
  const live = !!hostRpc();

  // read the current choice
  useEffect(() => {
    let on = true;
    setModel(NO_MODEL);
    setSid(null);
    if (!storedId) return;
    if (live) {
      // The gateway may still be connecting when the board mounts: retry a few times.
      let timer = 0;
      const attempt = (n: number) => {
        liveSession(docRef.current).then((r) => {
          if (!on || !r) return;
          setSid(r.sid);
          setModel((m) => mergeSessionInfo(m, r.info));
        }).catch((err) => {
          if (!on) return;
          if (n >= 4) { console.warn("[home-dashboard] board session model unavailable:", err); return; }
          timer = window.setTimeout(() => attempt(n + 1), 1500 * 2 ** n);
        });
      };
      attempt(0);
      return () => { on = false; window.clearTimeout(timer); };
    } else {
      fetchJSON<unknown>(`/api/sessions/${encodeURIComponent(storedId)}`)
        .then((row) => { if (on) setModel(modelFromSessionRow(row)); })
        .catch(() => { /* older dashboards: no model shown */ });
    }
    return () => { on = false; };
  }, [storedId, live, opts.refreshKey]);

  // the gateway republishes session.info on every switch, turn start and agent build
  useEffect(() => {
    if (!sid) return;
    const off = onGatewayEvent("session.info", (ev) => {
      if (ev?.session_id === sid) setModel((m) => mergeSessionInfo(m, ev.payload));
    });
    return () => { off?.(); };
  }, [sid]);

  const request = useCallback(async <T,>(method: string, params: Record<string, unknown>): Promise<T> => {
    const rpc = hostRpc();
    if (!rpc) throw new Error("no gateway");
    const d = docRef.current;
    let cur = sid ?? (await liveSession(d))?.sid;
    if (!cur) throw new Error("no live session");
    try {
      return await rpc<T>(method, { ...params, session_id: cur });
    } catch (err) {
      // the runtime id may be gone (reaped, gateway restarted): resume once and retry
      if (!/session not found|4001/i.test(String((err as Error)?.message ?? err))) throw err;
      dropLiveSession(d);
      const again = await liveSession(d, { fresh: true });
      if (!again || again.sid === cur) throw err;
      cur = again.sid;
      setSid(cur);
      return rpc<T>(method, { ...params, session_id: cur });
    }
  }, [sid]);

  const writeOption = useCallback(async (patch: ModelPreset) => {
    const before = modelRef.current;
    if (patch.effort) {
      setModel((m) => ({ ...m, effort: patch.effort!, effortPending: false, effortWire: "" }));
      try { await request("config.set", { key: "reasoning", value: patch.effort }); }
      catch (err) { setModel((m) => ({ ...m, effort: before.effort, effortPending: before.effortPending })); hostModelMenu()?.notifyError?.(err, opts.failureMessage); }
    }
    const tier = patch.serviceTier ?? (patch.fast === undefined ? undefined : patch.fast ? "priority" : "normal");
    if (tier !== undefined) {
      setModel((m) => ({ ...m, serviceTier: tier, fast: tier !== "normal" }));
      try { await request("config.set", { key: "fast", value: speedValue(tier) }); }
      catch (err) { setModel((m) => ({ ...m, serviceTier: before.serviceTier, fast: before.fast })); hostModelMenu()?.notifyError?.(err, opts.failureMessage); }
    }
  }, [request, opts.failureMessage]);

  const select = useCallback(async (next: string, provider: string): Promise<boolean> => {
    const before = modelRef.current;
    const paint = () => setModel((m) => ({ ...m, model: next, provider, effortWire: "" }));
    const rollback = () => setModel(before);
    const send = (confirm = false) => request<SwitchResult>("config.set", {
      key: "model", value: modelSwitchValue(next, provider), ...(confirm ? { confirm_expensive_model: true } : {}),
    });
    paint();
    setBusy(true);
    try {
      const r = await send();
      if (r?.confirm_required) {
        rollback();
        const menu = hostModelMenu();
        if (!menu?.confirm) return false;
        const ok = await menu.confirm({
          model: next, message: r.confirm_message, failureMessage: opts.failureMessage,
          requestConfirmed: async () => { paint(); return send(true); },
        });
        if (!ok) rollback();
        return ok;
      }
      return true;
    } catch (err) {
      rollback();
      hostModelMenu()?.notifyError?.(err, opts.failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }, [request, opts.failureMessage]);

  const canSwitch = live && !!storedId && !!sid && !!hostModelMenu();
  const controller: BoardModelController | null = canSwitch ? {
    allowSpeed: true,
    current: {
      model: model.model, provider: model.provider, effort: model.effort, effortPending: model.effortPending,
      effortWire: model.effortWire, fast: model.fast, serviceTier: model.serviceTier,
    },
    // Selecting a row restores what this board last used for that model (the menu passes the
    // preset it read from presetFor, or the defaults). Only what differs is written.
    applyPreset: (preset, row) => {
      const m = modelRef.current;
      const patch: ModelPreset = {};
      if (preset.effort !== undefined && preset.effort !== m.effort) patch.effort = preset.effort;
      const tier = preset.serviceTier ?? (preset.fast === undefined ? undefined : preset.fast ? "priority" : "normal");
      if (tier !== undefined && tier !== (m.serviceTier || "normal")) patch.serviceTier = tier;
      writePreset(store(), row.provider, row.model, preset);
      if (Object.keys(patch).length) void writeOption(patch);
    },
    presetFor: (provider, m) => readPresets(store())[presetKey(provider, m)] ?? {},
    select,
    // Like the composer: an edit on the active row goes to the session; on another row it is
    // only remembered for when that model is picked.
    setOptions: (patch, row) => {
      writePreset(store(), row.provider, row.model, patch);
      if (row.isActive) void writeOption(patch);
    },
  } : null;

  return { model, sid, controller, busy };
}
