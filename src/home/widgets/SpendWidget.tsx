import { useEffect, useState } from "react";
import { demoOn } from "@/demo";
import { getSpend, openSession } from "@/sdk";
import type { SpendBucket, SpendResponse, SpendSession } from "@/api-types";
import { useT, type MessageKey } from "../i18n";
import { HoverCtl } from "./HoverArrows";
import {
  SPEND_RANGES, TOP_MODES, amountBasis, capState, coerceCap, coerceSpendRange, coerceTopMode,
  coveredByBrand, formatCap, formatUsd, stepCap, type SpendRange,
} from "./spendModel";

const POLL_MS = 60_000;

const RANGE_LABEL: Record<SpendRange, MessageKey> = {
  today: "spend.range.today",
  week: "spend.range.week",
  month: "spend.range.month",
};

interface Props {
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
  editing: boolean;
  gridSize: { gw: number; gh: number };
}

/** What Hermes costs in money, not tokens. Real pay-per-use spend (API-key
 *  providers) is the headline, split by provider; value covered by flat-fee
 *  subscriptions (e.g. a Claude plan, priced by Hermes at API list prices) is
 *  shown apart and never added to it. Below: the month so far with a
 *  month-end projection against an optional monthly cap, and the most
 *  expensive sessions in range (click one to open it).
 *
 *  Hover controls: range (today / 7 days / this month), top-list ranking
 *  (all costs / real only) and the cap stepper; all persist in the widget's
 *  layout props. Data comes from this plugin's read-only `/spend` route. */
function SpendWidgetLive({ widgetProps, onWidgetPropsChange, editing, gridSize }: Props) {
  const t = useT();
  const range = coerceSpendRange(widgetProps.range);
  const topMode = coerceTopMode(widgetProps.top);
  const cap = coerceCap(widgetProps.cap);
  const [data, setData] = useState<SpendResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    const load = () => {
      getSpend(range, -new Date().getTimezoneOffset())
        .then((r) => { if (!cancelled) { setData(r); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); });
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [range]);

  const setProp = (patch: Record<string, unknown>) => onWidgetPropsChange({ ...widgetProps, ...patch });
  const idx = SPEND_RANGES.indexOf(range);
  const cycle = (dir: 1 | -1) =>
    setProp({ range: SPEND_RANGES[(idx + dir + SPEND_RANGES.length) % SPEND_RANGES.length] });

  const controls = (
    <HoverCtl className="tok-ctl">
      <button className="hv-arrow" aria-label={t("common.previous")} onClick={() => cycle(-1)}>‹</button>
      <span className="hv-label">{t(RANGE_LABEL[range])}</span>
      <button className="hv-arrow" aria-label={t("common.next")} onClick={() => cycle(1)}>›</button>
      <span className="tok-div" />
      <button
        className={`hv-opt${topMode === "real" ? " on" : ""}`}
        onClick={() => setProp({ top: TOP_MODES[(TOP_MODES.indexOf(topMode) + 1) % TOP_MODES.length] })}
        title={t("spend.topTitle")}
        data-top={topMode}
      >
        {t(`spend.top.${topMode}`)}
      </button>
      <span className="tok-div" />
      <span className="hv-label" title={t("spend.capTitle")}>{t("spend.cap")}</span>
      <button className="hv-arrow" aria-label={t("common.previous")} disabled={cap <= 0}
        onClick={() => setProp({ cap: stepCap(cap, -1) })}>‹</button>
      <span className="hv-label spend-cap-val" data-cap={cap}>{cap > 0 ? formatCap(cap) : t("spend.capOff")}</span>
      <button className="hv-arrow" aria-label={t("common.next")}
        onClick={() => setProp({ cap: stepCap(cap, 1) })}>›</button>
    </HoverCtl>
  );

  if (!data) {
    return (
      <div>
        {controls}
        <span className="dim">{failed ? t("common.unavailable") : t("common.loading")}</span>
      </div>
    );
  }
  if (!data.available) {
    return <div>{controls}<span className="dim">{t("spend.noStore")}</span></div>;
  }

  const real = data.real!;
  const covered = data.covered!;
  const unclassified = data.unclassified!;
  const month = data.month!;
  const state = capState(month.real, month.projection, cap);
  const top = (topMode === "real" ? data.top_real : data.top) ?? [];
  // Height tiers: the headline, covered line and month line always show;
  // providers and the top list take whatever rows the widget has left.
  const providerRows = gridSize.gh >= 4 ? Math.min(3, real.by_provider.length) : 0;
  const topRows = Math.max(0, Math.min(5, gridSize.gh * 2 - 6 - providerRows));
  const plans = coveredByBrand(covered.by_provider);
  const noCost = data.sessions?.without_cost ?? 0;

  return (
    <div className="home-spend" data-cap-state={state}>
      {controls}
      <div className="spend-head">
        <span className="bigval">{formatUsd(real.total)}</span>
        <span className="dim" title={t("spend.realTitle")}> {t("spend.real")} · {t(RANGE_LABEL[range])}</span>
        {real.total > 0 && <BasisTag bucket={real} />}
      </div>

      {!data.has_data ? (
        <div className="dim">{t("spend.empty")}</div>
      ) : (
        <>
          {providerRows > 0 && real.by_provider.length > 0 && (
            <div className="spend-providers">
              {real.by_provider.slice(0, providerRows).map((p) => (
                <div
                  className="row tok-group"
                  key={p.provider || "\u0000"}
                  style={{ "--share": `${Math.max(1, Math.min(100, real.total > 0 ? (p.cost / real.total) * 100 : 0))}%` } as React.CSSProperties}
                  title={`${p.provider} · ${p.sessions} · ${p.basis}`}
                >
                  <span className="row-name">{p.provider || t("tokens.unknownProvider")}</span>
                  <span>{formatUsd(p.cost)}</span>
                </div>
              ))}
            </div>
          )}
          {real.total <= 0 && <div className="dim">{t("spend.noReal")}</div>}

          {plans.length > 0 && (
            <div className="spend-covered" title={t("spend.coveredTitle")}>
              {plans.map((p) => (
                <div key={p.brand}>
                  {t("spend.covered", {
                    plan: t("spend.plan", { brand: p.brand }),
                    amount: formatUsd(p.cost),
                  })}
                  {covered.actual <= 0 && <span className="dim"> · {t("spend.est")}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className={`spend-month spend-${state}`}>
        <span>{t("spend.month", { spent: formatUsd(month.real) })}</span>
        <span className="dim" title={t("spend.projectedTitle")}> {t("spend.projected", { amount: formatUsd(month.projection) })}</span>
        {cap > 0 && <span className="dim"> {t("spend.capOf", { cap: formatCap(cap) })}</span>}
        {(state === "near" || state === "pace" || state === "over") && (
          <span className="spend-flag"> · {t(`spend.state.${state}`)}</span>
        )}
      </div>

      {topRows > 0 && data.has_data && (
        <TopSessions sessions={top.slice(0, topRows)} editing={editing} real={topMode === "real"} />
      )}

      {(unclassified.total > 0 || unclassified.unknown_cost_sessions > 0 || (gridSize.gh >= 6 && noCost > 0)) && (
        <div className="spend-foot dim">
          {unclassified.total > 0 && (
            <span title={t("spend.unclassifiedTitle")}>{t("spend.unclassified", { amount: formatUsd(unclassified.total) })}</span>
          )}
          {unclassified.unknown_cost_sessions > 0 && (
            <span title={t("spend.unpricedTitle")}>{t("spend.unpriced", { n: unclassified.unknown_cost_sessions })}</span>
          )}
          {gridSize.gh >= 6 && noCost > 0 && <span>{t("spend.noCost", { n: noCost })}</span>}
        </div>
      )}
    </div>
  );
}

function BasisTag({ bucket }: { bucket: Pick<SpendBucket, "estimated" | "actual"> }) {
  const t = useT();
  const basis = amountBasis(bucket);
  if (basis === "actual") return null;
  return basis === "mixed"
    ? <span className="spend-est" title={t("spend.partEstTitle")}>{t("spend.partEst")}</span>
    : <span className="spend-est" title={t("spend.estTitle")}>{t("spend.est")}</span>;
}

/** Most expensive sessions in range; a row click opens the session through
 *  the host (chat resume on the web, the session view on Desktop). */
function TopSessions({ sessions, editing, real }: { sessions: SpendSession[]; editing: boolean; real: boolean }) {
  const t = useT();
  if (sessions.length === 0) return <div className="spend-top dim">{t("spend.topEmpty")}</div>;
  return (
    <div className="spend-top">
      <div className="spend-top-head dim">{t(real ? "spend.topHeadReal" : "spend.topHead")}</div>
      {sessions.map((s) => {
        const title = s.title || s.source || t("spend.untitled");
        const open = () => { if (!editing) openSession(s.id); };
        return (
          <div
            key={s.id}
            className="row spend-session"
            role="button"
            tabIndex={editing ? -1 : 0}
            onClick={(e) => { e.stopPropagation(); open(); }}
            onPointerDown={(e) => { if (!editing) e.stopPropagation(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
            title={t("spend.openTitle", { title, cost: formatUsd(s.cost), provider: s.provider || "?" })}
            data-session-id={s.id}
          >
            <span className="row-name">{title}</span>
            <span className={`spend-tag spend-tag-${s.class}`}>{t(`spend.tag.${s.class}`)}</span>
            <span className="spend-cost">{formatUsd(s.cost)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Demo mode shows no money at all: the widget stands down instead of masking each figure. */
export function SpendWidget(props: Props) {
  const t = useT();
  if (demoOn()) return <span className="dim">{t("demo.masked")}</span>;
  return <SpendWidgetLive {...props} />;
}
