// Board sync: confirmed server document + optimistic pending batches + polling by op cursor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boardsApi } from "./api";
import { applyEntries, applyOps, remapIds, type BoardDoc, type Entry, type Op, type Presence } from "./model";

interface Pending { ops: Op[]; note?: string; confirmedAt?: number; undoable: boolean }

export interface BoardSync {
  doc: BoardDoc | null;
  error: string | null;
  presence: Presence | null;
  savedAt: number | null;
  commit: (ops: Op[], opts?: { note?: string; undoable?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  undoEntry: (s: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  refresh: () => void;
}

/** Hermes is "active" for this long after his last write or read. */
export const HERMES_ACTIVE_S = 30;

export function useBoard(
  bid: string,
  onHermesEntries?: (entries: Entry[], doc: BoardDoc) => void,
  /** The server gave optimistic `$ref` items their real ids (so the UI can carry selection / editing over). */
  onRemap?: (ids: Record<string, string>) => void,
): BoardSync {
  const [confirmed, setConfirmed] = useState<BoardDoc | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [stacks, setStacks] = useState<{ undo: number[]; redo: number[] }>({ undo: [], redo: [] });
  const confirmedRef = useRef<BoardDoc | null>(null);
  const pendingRef = useRef<Pending[]>([]);
  const inflight = useRef(false);
  const pulling = useRef<Promise<void> | null>(null);
  const hermesCb = useRef(onHermesEntries);
  hermesCb.current = onHermesEntries;
  const remapCb = useRef(onRemap);
  remapCb.current = onRemap;
  const alive = useRef(true);

  const setDoc = (d: BoardDoc | null) => { confirmedRef.current = d; setConfirmed(d); };
  const setQueue = (q: Pending[]) => { pendingRef.current = q; setPending(q); };

  const pull = useCallback((): Promise<void> => {
    if (pulling.current) return pulling.current;
    const run = (async () => {
      const cur = confirmedRef.current;
      try {
        const r = await boardsApi.since(bid, cur ? cur.seq : -1);
        if (!alive.current) return;
        setError(null);
        if (r.hermes) setPresence(r.hermes);
        let next = cur;
        if (r.doc) {
          next = r.doc;
        } else if (r.entries && cur) {
          next = applyEntries(cur, r.entries);
          const hermes = r.entries.filter((e) => e.by === "h");
          if (hermes.length) hermesCb.current?.(hermes, next);
        }
        if (next && next !== cur) {
          setDoc(next);
          const left = pendingRef.current.filter((p) => !(p.confirmedAt && p.confirmedAt <= next!.seq));
          if (left.length !== pendingRef.current.length) setQueue(left);
        }
      } catch (e) {
        if (alive.current) setError(String((e as Error)?.message ?? e));
      }
    })();
    pulling.current = run.finally(() => { pulling.current = null; });
    return pulling.current;
  }, [bid]);

  const flush = useCallback(async () => {
    if (inflight.current) return;
    const batch = pendingRef.current.find((p) => !p.confirmedAt);
    if (!batch) return;
    inflight.current = true;
    try {
      const res = await boardsApi.ops(bid, batch.ops, batch.note);
      if (!alive.current) return;
      const ids = res.entry.ids ?? {};
      if (Object.keys(ids).length) remapCb.current?.(ids);
      const cur = confirmedRef.current;
      let q = pendingRef.current.map((p) => (p === batch || p.confirmedAt ? p : { ...p, ops: remapIds(p.ops, ids) }));
      if (res.entry.noop) {
        q = q.filter((p) => p !== batch);
      } else if (cur && res.entry.s === cur.seq + 1) {
        setDoc(applyEntries(cur, [res.entry]));
        q = q.filter((p) => p !== batch);
      } else {
        q = q.map((p) => (p === batch ? { ...p, confirmedAt: res.entry.s } : p));
        void pull();
      }
      setQueue(q);
      setSavedAt(Date.now());
      if (batch.undoable && !res.entry.noop) setStacks((s) => ({ undo: [...s.undo.slice(-99), res.entry.s], redo: [] }));
    } catch (e) {
      if (!alive.current) return;
      setError(String((e as Error)?.message ?? e));
      setQueue(pendingRef.current.filter((p) => p !== batch));
      void pull();
    } finally {
      inflight.current = false;
      if (alive.current && pendingRef.current.some((p) => !p.confirmedAt)) void flush();
    }
  }, [bid, pull]);

  const commit = useCallback((ops: Op[], opts?: { note?: string; undoable?: boolean }) => {
    if (!ops.length) return;
    setQueue([...pendingRef.current, { ops, note: opts?.note, undoable: opts?.undoable !== false }]);
    void flush();
  }, [flush]);

  const runUndo = useCallback(async (s: number, push: "undo" | "redo" | null) => {
    try {
      const res = await boardsApi.undo(bid, s);
      if (push && !res.entry.noop) {
        setStacks((st) => (push === "redo"
          ? { undo: st.undo, redo: [...st.redo, res.entry.s] }
          : { undo: [...st.undo, res.entry.s], redo: st.redo }));
      }
      await pull();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  }, [bid, pull]);

  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;

  const undo = useCallback(() => {
    const st = stacksRef.current;
    const s = st.undo[st.undo.length - 1];
    if (s == null) return;
    setStacks({ undo: st.undo.slice(0, -1), redo: st.redo });
    void runUndo(s, "redo");
  }, [runUndo]);

  const redo = useCallback(() => {
    const st = stacksRef.current;
    const s = st.redo[st.redo.length - 1];
    if (s == null) return;
    setStacks({ undo: st.undo, redo: st.redo.slice(0, -1) });
    void runUndo(s, "undo");
  }, [runUndo]);

  const undoEntry = useCallback((s: number) => { void runUndo(s, "redo"); }, [runUndo]);

  // load + poll: 1.5 s while Hermes is active, 3 s otherwise, paused while the tab is hidden
  useEffect(() => {
    alive.current = true;
    setDoc(null);
    setQueue([]);
    setStacks({ undo: [], redo: [] });
    let timer: ReturnType<typeof setTimeout> | null = null;
    let first = true;
    const tick = async () => {
      if (first || !document.hidden) await pull();
      first = false;
      if (!alive.current) return;
      const p = presenceRef.current;
      const active = p && Date.now() / 1000 - p.at < HERMES_ACTIVE_S;
      timer = setTimeout(tick, active ? 1500 : 3000);
    };
    void tick();
    const onVis = () => { if (!document.hidden) void pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bid, pull]);

  const presenceRef = useRef<Presence | null>(null);
  presenceRef.current = presence;

  const doc = useMemo(() => {
    if (!confirmed) return null;
    const ops = pending.flatMap((p) => p.ops);
    return ops.length ? applyOps(confirmed, ops) : confirmed;
  }, [confirmed, pending]);

  return {
    doc, error, presence, savedAt, commit, undo, redo, undoEntry,
    canUndo: stacks.undo.length > 0, canRedo: stacks.redo.length > 0,
    refresh: () => { void pull(); },
  };
}
