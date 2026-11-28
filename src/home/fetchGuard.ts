// Guards for widget requests. A host request that never settles (the Webapp proxies every call
// through one remote gateway, which can stall under load) used to leave a widget on "loading…"
// forever: nothing timed out, nothing retried. These make every fetch settle, then try again.

export class TimeoutError extends Error {
  constructor(ms: number) { super(`no response after ${ms} ms`); this.name = "TimeoutError"; }
}

/** Rejects when `run()` has not settled within `ms`. The late result is dropped. */
export function withTimeout<T>(run: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    let p: Promise<T>;
    try { p = run(); } catch (e) { clearTimeout(timer); reject(e); return; }
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RetryOptions {
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Total attempts (first try included). */
  tries?: number;
  /** Wait before attempt n+1 is `backoffMs * n`. */
  backoffMs?: number;
  /** Stop quietly (reject with `Cancelled`) when this returns true between attempts. */
  cancelled?: () => boolean;
}

export class Cancelled extends Error {
  constructor() { super("cancelled"); this.name = "Cancelled"; }
}

/** `run()` with a timeout per attempt and a few retries; rejects with the last error. */
export async function fetchRetry<T>(run: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { timeoutMs = 12_000, tries = 3, backoffMs = 800, cancelled } = opts;
  let last: unknown;
  for (let n = 1; n <= tries; n++) {
    if (cancelled?.()) throw new Cancelled();
    try {
      return await withTimeout(run, timeoutMs);
    } catch (e) {
      last = e;
      if (n < tries) await sleep(backoffMs * n);
    }
  }
  if (cancelled?.()) throw new Cancelled();
  throw last;
}
