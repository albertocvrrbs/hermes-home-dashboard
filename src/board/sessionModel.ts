// The model of a board's linked session: what the chat panel header shows, and the pure half of
// the model picker (labels, the `config.set` values, the per-model presets the picker remembers).
//
// The menu itself is Hermes Desktop's own `ModelCatalogMenu` (see src/desktop/modelPicker.tsx);
// this file only decides what a pick MEANS for the board: a session-scoped switch of the board's
// session, exactly what a chat tile does, never a write to the profile default.

/** The live choice of one session, in the shape the Desktop menu reads (`ModelChoice`). */
export interface SessionModel {
  model: string;
  provider: string;
  /** '' = inherit the default, 'none' = thinking off, else a level. */
  effort: string;
  /** True while the effort is not reported yet ('' is unknown, not "default"). */
  effortPending: boolean;
  effortWire: string;
  fast: boolean;
  serviceTier: string;
}

export const NO_MODEL: SessionModel = {
  model: "", provider: "", effort: "", effortPending: true, effortWire: "", fast: false, serviceTier: "",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Merge a gateway `session.info` payload (or a `session.resume` `info`) into the last known
 *  choice. Fields the payload doesn't carry keep their value: a lazy resume reports only the
 *  model and provider, the full `session.info` arrives once the agent is built. */
export function mergeSessionInfo(prev: SessionModel, info: unknown): SessionModel {
  if (!info || typeof info !== "object") return prev;
  const r = info as Record<string, unknown>;
  const next = { ...prev };
  if (str(r.model)) next.model = str(r.model);
  if ("provider" in r && str(r.provider)) next.provider = str(r.provider);
  if (typeof r.reasoning_effort === "string") {
    next.effort = r.reasoning_effort.trim();
    next.effortPending = false;
    next.effortWire = str(r.reasoning_effort_wire);
  }
  if (typeof r.fast === "boolean") next.fast = r.fast;
  if (typeof r.service_tier === "string") next.serviceTier = r.service_tier.trim();
  return next;
}

/** A stored session row (web dashboard `GET /api/sessions/{id}`): model and billing provider. */
export function modelFromSessionRow(row: unknown): SessionModel {
  if (!row || typeof row !== "object") return NO_MODEL;
  const r = row as Record<string, unknown>;
  let effort = "";
  let pending = true;
  try {
    const cfg = typeof r.model_config === "string" ? JSON.parse(r.model_config) : r.model_config;
    const rc = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>).reasoning_config : null;
    if (rc && typeof rc === "object") {
      const o = rc as Record<string, unknown>;
      effort = o.enabled === false ? "none" : str(o.effort);
      pending = false;
    }
  } catch { /* model_config is advisory */ }
  return { ...NO_MODEL, model: str(r.model), provider: str(r.billing_provider), effort, effortPending: pending };
}

/** The `config.set model` value for a board pick. Always `--session`: the board's session is
 *  never the primary chat, so a pick must not rewrite the profile default (the rule Desktop
 *  applies to every secondary tile). */
export function modelSwitchValue(model: string, provider: string): string {
  const m = model.trim();
  const p = provider.trim();
  return p ? `${m} --provider ${p} --session` : `${m} --session`;
}

/** The `config.set fast` word for a service tier, as Desktop writes it. */
export function speedValue(tier: string): string {
  return tier === "priority" ? "fast" : tier || "normal";
}

// ── display names (a port of Desktop's lib/model-status-label.ts `modelDisplayParts`) ──────

const VARIANTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/-fast$/i, "Fast"], [/-flash$/i, "Flash"], [/-thinking$/i, "Thinking"], [/-preview$/i, "Preview"], [/-latest$/i, "Latest"],
];

const VENDOR: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDeepseek\b/g, "DeepSeek"], [/\bGlm\b/g, "GLM"], [/\bMinimax\b/g, "MiniMax"], [/\bOpenai\b/g, "OpenAI"],
  [/\bErnie\b/g, "ERNIE"], [/\bMimo\b/g, "MiMo"], [/\bVl\b/g, "VL"], [/\bFp8\b/g, "FP8"], [/\bAi\b/g, "AI"],
];

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function vendorCase(s: string): string {
  let out = s.replace(/\b(a?)(\d+(?:\.\d+)?)b\b/gi, (_m, a: string, n: string) => `${a.toUpperCase()}${n}B`);
  for (const [re, to] of VENDOR) out = out.replace(re, to);
  return out;
}

function prettify(base: string): string {
  if (/^claude-/i.test(base)) return vendorCase(titleCase(base.replace(/^claude-/i, "").replace(/(\d)-(?=\d)/g, "$1.").replace(/-/g, " ")));
  if (/^gpt-/i.test(base)) return base.replace(/^gpt-/i, "GPT-");
  if (/^gemini-/i.test(base)) return vendorCase(titleCase(base.replace(/^gemini-/i, "Gemini ").replace(/-/g, " ")));
  return vendorCase(titleCase(base.replace(/-/g, " ")));
}

/** Friendly model name, the way the Desktop composer pill writes it: provider prefix and date
 *  pin dropped, vendor casing kept, the variant as a ` · Tag` (`DeepSeek V4 · Flash`). */
export function modelDisplayName(model: string): string {
  const id = model.trim();
  if (!id) return "";
  let base = id.slice(id.lastIndexOf("/") + 1);
  let variant = "";
  for (const [re, label] of VARIANTS) {
    if (re.test(base)) { variant = label; base = base.replace(re, ""); break; }
  }
  const ctx = base.match(/\[(\d+[mk])\]$/i);
  const tags = [variant];
  if (ctx) { tags.push(ctx[1].toUpperCase()); base = base.slice(0, -ctx[0].length); }
  base = base.replace(/-\d{8}$/, "");
  const name = prettify(base) || id;
  const tag = tags.filter(Boolean).join(" ");
  return tag ? `${name} · ${tag}` : name;
}

// Desktop's compact labels (lib/reasoning-effort.ts SHORT_LABELS), used in the pill and the rows.
const EFFORT_LABELS: Record<string, string> = {
  none: "Off", minimal: "Min", low: "Low", medium: "Med", high: "High", xhigh: "XHigh", max: "Max", ultra: "Ultra",
};

/** The reasoning level as Desktop's compact chip writes it ('' while unknown or inherited). */
export function effortLabel(m: SessionModel): string {
  if (m.effortPending || !m.effort) return "";
  return EFFORT_LABELS[m.effort.toLowerCase()] ?? m.effort;
}

/** Tooltip detail: the model, plus the reasoning level when the session reports one. The pill
 *  itself shows only the model, like the composer pill (Desktop shows effort in its own chip). */
export function sessionModelLabel(m: SessionModel): string {
  const name = modelDisplayName(m.model);
  if (!name) return "";
  const effort = effortLabel(m);
  return effort ? `${name} · ${effort}` : name;
}

// ── per-model presets (the board's own memory, like the composer's) ───────────────────────

export interface ModelPreset { effort?: string; fast?: boolean; serviceTier?: string }

const PRESETS_KEY = "hb.modelPresets";

export const presetKey = (provider: string, model: string) => `${provider.trim().toLowerCase()}::${model.trim()}`;

export function readPresets(storage: Pick<Storage, "getItem"> | null): Record<string, ModelPreset> {
  try {
    const v = JSON.parse(storage?.getItem(PRESETS_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function writePreset(storage: Pick<Storage, "getItem" | "setItem"> | null, provider: string, model: string, patch: ModelPreset): void {
  if (!storage) return;
  const all = readPresets(storage);
  const key = presetKey(provider, model);
  all[key] = { ...all[key], ...patch };
  // keep the memory bounded: newest 60 models
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k];
  try { storage.setItem(PRESETS_KEY, JSON.stringify(all)); } catch { /* quota / private mode */ }
}
