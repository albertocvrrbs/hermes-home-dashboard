// Raw gateway / platform runtime states as words in the UI language.
import type { MessageKey } from "../i18n/locales/en";

export const GATEWAY_STATES = [
  "running", "starting", "stopped", "startup_failed", "draining", "connected", "connecting",
  "disconnected", "degraded", "disabled", "fatal", "paused", "retrying", "error",
] as const;
const KNOWN: ReadonlySet<string> = new Set(GATEWAY_STATES);

/** `startup_failed` -> "failed to start" / "falló al iniciar"; states we don't know pass through untouched. */
export function stateLabel(t: (key: MessageKey) => string, raw: string | null | undefined): string {
  if (!raw) return "—";
  return KNOWN.has(raw) ? t(`gateway.s.${raw}` as MessageKey) : raw;
}
