import { useState } from "react";
import type { PaginatedSessions, StatusResponse } from "@/api-types";
import { formatTokenCount } from "../format";
import { useT } from "../i18n";
import { HoverCtl } from "./HoverArrows";
import {
  SESSION_SORTS, TOKEN_FLOORS, arrangeSessions, coerceSessionSort, coerceTokenFloor, sessionTokens,
} from "./sessionSort";

const PER_PAGE = 3;

interface Props {
  status: StatusResponse | null;
  sessions: PaginatedSessions | null;
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
}

/** Active session count + recent sessions. Hover controls page through the
 *  loaded list (3 at a time), switch the order between most recent and most
 *  tokens, and step a minimum-token filter (all / ≥10K / ≥100K / ≥1M, input +
 *  output). Sort and filter persist in the widget's layout props; both work
 *  over the recent sessions the Home already loads. */
export function SessionsWidget({ status, sessions, widgetProps, onWidgetPropsChange }: Props) {
  const t = useT();
  const [page, setPage] = useState(0);
  if (!status && !sessions) return <span className="dim">{t("common.loading")}</span>;

  const sort = coerceSessionSort(widgetProps.sort);
  const minTokens = coerceTokenFloor(widgetProps.minTokens);
  const setProp = (patch: Record<string, unknown>) => {
    setPage(0);
    onWidgetPropsChange({ ...widgetProps, ...patch });
  };
  const nextSort = () =>
    setProp({ sort: SESSION_SORTS[(SESSION_SORTS.indexOf(sort) + 1) % SESSION_SORTS.length] });
  const nextFloor = () =>
    setProp({ minTokens: TOKEN_FLOORS[(TOKEN_FLOORS.indexOf(minTokens) + 1) % TOKEN_FLOORS.length] });

  const all = arrangeSessions(sessions?.sessions ?? [], sort, minTokens);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const slice = all.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
  // Token counts show once the user is looking at tokens (sorting or filtering).
  const showTokens = sort === "tokens" || minTokens > 0;

  return (
    <div>
      <HoverCtl className="tok-ctl">
        {pages > 1 && (
          <>
            <button
              className="hv-arrow"
              aria-label={t("common.previous")}
              disabled={p <= 0}
              onClick={() => setPage(Math.max(0, p - 1))}
            >
              ‹
            </button>
            <span className="hv-label">{p + 1}/{pages}</span>
            <button
              className="hv-arrow"
              aria-label={t("common.next")}
              disabled={p >= pages - 1}
              onClick={() => setPage(Math.min(pages - 1, p + 1))}
            >
              ›
            </button>
            <span className="tok-div" />
          </>
        )}
        <button
          className={`hv-opt${sort === "tokens" ? " on" : ""}`}
          onClick={nextSort}
          title={t("sessions.sortTitle")}
          data-sort={sort}
        >
          {t(`sessions.sort.${sort}`)}
        </button>
        <button
          className={`hv-opt${minTokens > 0 ? " on" : ""}`}
          onClick={nextFloor}
          title={t("sessions.filterTitle")}
          data-min-tokens={minTokens}
        >
          {minTokens > 0 ? `≥${formatTokenCount(minTokens)}` : t("sessions.filter.all")}
        </button>
      </HoverCtl>
      <span className="bigval">{status?.active_sessions ?? "—"}</span>
      <span className="dim"> {t("sessions.active")}</span>
      <div className="rows">
        {slice.length === 0 && minTokens > 0 && (
          <span className="dim">{t("sessions.noneMatch", { n: formatTokenCount(minTokens) })}</span>
        )}
        {slice.map((s) => (
          <div className="row" key={s.id}>
            <span className="dim row-name" title={s.title ?? s.source ?? s.id}>
              {s.title ?? s.source ?? s.id}
            </span>
            {showTokens && (
              <span
                className="ses-tok"
                title={t("sessions.tokensTitle", {
                  input: formatTokenCount(s.input_tokens ?? 0),
                  output: formatTokenCount(s.output_tokens ?? 0),
                })}
              >
                {formatTokenCount(sessionTokens(s))}
              </span>
            )}
            <span className={s.is_active ? "ok" : "dim"}>
              {s.is_active ? t("sessions.live") : t("sessions.idle")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
