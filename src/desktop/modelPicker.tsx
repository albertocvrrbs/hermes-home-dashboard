// Hermes Desktop's own model menu in the board's chat panel.
//
// The menu is NOT ours: `ModelCatalogMenu` from the Desktop SDK is the component the chat
// composer renders, so search, provider groups, favourites, `-fast` families and the per-row
// thinking/effort/speed submenu look and behave exactly the same. The board only supplies the
// controller (what a pick means: a session-scoped switch of the board's linked session, see
// src/board/useSessionModel.ts) and the trigger pill, styled like the composer's model pill.
import { useState } from "react";
import type { ModelMenuHost, ModelPickerProps, ModelSwitchConfirm } from "../sdk";
import { pickerSdk } from "./modelMenuSdk";

// The composer pill's classes (apps/desktop/src/app/chat/composer/model-pill.tsx), so the trigger
// reads as the same control. Height comes from board.css (.hb-model): the composer's
// --composer-control-size isn't defined outside the composer.
const PILL = "min-w-0 shrink gap-1 rounded-md px-2 text-xs font-normal text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground";

export function createModelMenuHost(ns: unknown): ModelMenuHost | undefined {
  const sdk = pickerSdk(ns);
  if (!sdk) return undefined;
  const { ModelCatalogMenu, CloseProvider, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Codicon, Button, Chevron } = sdk;

  function Picker({ controller, sessionId, profile, label, title, refreshLabel, className }: ModelPickerProps) {
    const [open, setOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // the same cache the composer's switch invalidates, so the next open re-reads the catalog
    const queryClient = sdk!.useQueryClient?.();
    const ctl = {
      ...controller,
      select: async (model: string, provider: string) => {
        const ok = await controller.select(model, provider);
        if (ok !== false) void queryClient?.invalidateQueries({ queryKey: ["model-options"] });
        return ok;
      },
    };
    // The composer's footer row: re-pull every provider's live list (busts the backend's 1 h
    // catalog cache), then let the menu re-read it.
    const refresh = async () => {
      if (refreshing || !sdk!.request) return;
      setRefreshing(true);
      try {
        await sdk!.request("model.options", { session_id: sessionId, refresh: true, explicit_only: true });
      } catch { /* the plain re-read below still runs */ }
      finally {
        setRefreshing(false);
        void queryClient?.invalidateQueries({ queryKey: ["model-options"] });
      }
    };
    const footer = DropdownMenuItem && sdk!.request ? (
      <DropdownMenuItem className="gap-2 rounded-none px-2.5 py-1 text-xs text-(--ui-text-tertiary)" disabled={refreshing}
        onSelect={(e: Event) => { e.preventDefault(); void refresh(); }}>
        {Codicon ? <Codicon name="sync" size="0.75rem" spinning={refreshing} /> : null}
        {refreshLabel}
      </DropdownMenuItem>
    ) : undefined;
    const body = (
      <>
        <span className="truncate">{label}</span>
        {Chevron ? <Chevron className="size-2.5 shrink-0 opacity-50" /> : <span aria-hidden="true" className="hb-model-caret" />}
      </>
    );
    const triggerProps = {
      "aria-label": title, "data-tip": title, className: `${PILL} hb-model ${className ?? ""}`, type: "button" as const,
    };
    return (
      <DropdownMenu open={open} onOpenChange={(v: unknown) => setOpen(!!v)}>
        <DropdownMenuTrigger asChild>
          {Button ? <Button {...triggerProps} variant="ghost">{body}</Button> : <button {...triggerProps}>{body}</button>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-0" side="bottom" sideOffset={6}>
          <CloseProvider value={() => setOpen(false)}>
            <ModelCatalogMenu controller={ctl} footer={footer} includeMoa profile={profile} request={sdk!.request} sessionId={sessionId} />
          </CloseProvider>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const confirm = sdk.surfaceModelSwitchConfirm
    ? (o: ModelSwitchConfirm) => sdk.surfaceModelSwitchConfirm!({
      confirmMessage: o.message, failureMessage: o.failureMessage, model: o.model, requestConfirmed: o.requestConfirmed,
    })
    : undefined;
  const notifyError = sdk.notifyError
    ? (error: unknown, fallback: string) => { try { sdk.notifyError!(error, fallback); } catch { /* best effort */ } }
    : undefined;

  return { Picker, confirm, notifyError };
}
