declare module "@hermes/plugin-sdk" {
  import type { ReactNode } from "react";

  export interface PluginRestOptions {
    method?: string;
    body?: unknown;
    timeoutMs?: number;
  }

  export interface PluginContribution {
    id: string;
    area: string;
    title?: string;
    order?: number;
    data?: unknown;
    render?: () => ReactNode;
  }

  /** Plugin-scoped i18n (newer Desktop builds). The active locale is always
   *  the app's `display.language`. */
  export interface PluginI18n {
    register(bundles: Record<string, Record<string, string>>): () => void;
    t(key: string, ...args: unknown[]): string;
    onLocaleChange?(listener: () => void): () => void;
  }

  export interface PluginContext {
    readonly source: string;
    register(contribution: PluginContribution): () => void;
    registerMany(contributions: PluginContribution[]): () => void;
    rest<T>(path: string, options?: PluginRestOptions): Promise<T>;
    /** Absent on older Desktop builds — feature-detect. */
    i18n?: PluginI18n;
  }

  export interface HermesPlugin {
    id: string;
    name?: string;
    defaultEnabled?: boolean;
    register(ctx: PluginContext): void;
  }

  export interface RpcEvent<T = unknown> {
    type: string;
    payload?: T;
    session_id?: string;
    profile?: string;
  }

  export const host: {
    status(): Promise<unknown>;
    logs(params: {
      file?: string;
      lines?: number;
      level?: string;
      component?: string;
    }): Promise<unknown>;
    navigate(path: string): void;
    /** Open a stored session core-style (newer Desktop builds). */
    openSession?(id: string, options?: { profile?: string; intent?: "in-place" | "stack" | "tab" | "window" }): unknown;
    newChat?(profile?: string): unknown;
    composer?: {
      setDraft?(sessionId: string | null, text: string): Promise<boolean>;
      focus?(sessionId: string | null): void;
    };
    request?<T>(method: string, params?: Record<string, unknown>): Promise<T>;
    /** Subscribe to live gateway events by type ('*' = everything). Returns a disposer. */
    onEvent(type: string, listener: (event: RpcEvent) => void): () => void;
  };
}
