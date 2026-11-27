// Feature detection for Desktop's model menu. A Desktop build that doesn't export the menu (or
// the dropdown it lives in) gets no picker: the board chat keeps showing the model read-only.
import type { ComponentType, ReactNode } from "react";

export type AnyComponent = ComponentType<Record<string, unknown> & { children?: ReactNode }>;

export interface PickerSdk {
  ModelCatalogMenu: AnyComponent;
  CloseProvider: AnyComponent;
  DropdownMenu: AnyComponent;
  DropdownMenuTrigger: AnyComponent;
  DropdownMenuContent: AnyComponent;
  Button?: AnyComponent;
  Chevron?: AnyComponent;
  /** For the composer's "Refresh models" footer row. */
  DropdownMenuItem?: AnyComponent;
  Codicon?: AnyComponent;
  useQueryClient?: () => { invalidateQueries(q: { queryKey: unknown[] }): unknown };
  surfaceModelSwitchConfirm?: (o: Record<string, unknown>) => Promise<boolean>;
  request?: <T>(method: string, params?: Record<string, unknown>) => Promise<T>;
  notifyError?: (error: unknown, fallback?: string) => void;
}

const isComponent = (v: unknown): v is AnyComponent =>
  typeof v === "function" || (!!v && typeof v === "object" && "$$typeof" in (v as object));

const fn = <T,>(v: unknown): T | undefined => (typeof v === "function" ? (v as T) : undefined);

/** The parts of the `@hermes/plugin-sdk` namespace the picker needs, or null when the menu is
 *  missing. Optional parts (Button, the chevron icon, the confirm flow) degrade on their own. */
export function pickerSdk(ns: unknown): PickerSdk | null {
  const sdk = (ns ?? {}) as Record<string, unknown>;
  const close = sdk.ModelMenuCloseContext as { Provider?: unknown } | undefined;
  const { ModelCatalogMenu, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } = sdk;
  if (!isComponent(ModelCatalogMenu) || !isComponent(close?.Provider) || !isComponent(DropdownMenu)
    || !isComponent(DropdownMenuTrigger) || !isComponent(DropdownMenuContent)) return null;
  const host = (sdk.host ?? {}) as Record<string, unknown>;
  const icons = (sdk.icons ?? {}) as Record<string, unknown>;
  const request = fn<PickerSdk["request"]>(host.request);
  const notifyError = fn<PickerSdk["notifyError"]>(host.notifyError);
  return {
    ModelCatalogMenu, CloseProvider: close!.Provider as AnyComponent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    Button: isComponent(sdk.Button) ? sdk.Button : undefined,
    Chevron: isComponent(icons.ChevronDown) ? icons.ChevronDown : undefined,
    DropdownMenuItem: isComponent(sdk.DropdownMenuItem) ? sdk.DropdownMenuItem : undefined,
    Codicon: isComponent(sdk.Codicon) ? sdk.Codicon : undefined,
    useQueryClient: fn(sdk.useQueryClient),
    surfaceModelSwitchConfirm: fn(sdk.surfaceModelSwitchConfirm),
    request: request ? (m, p) => request.call(host, m, p) : undefined,
    notifyError: notifyError ? (e, f) => notifyError.call(host, e, f) : undefined,
  } as PickerSdk;
}
