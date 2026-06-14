import type { ComponentType } from "react";
import type { HomeData, HomeDataSource } from "../useHomeData";
import { NotesWidget } from "./NotesWidget";
import { AsciiWidget } from "./AsciiWidget";
import { ClockWidget } from "./ClockWidget";
import { MatrixWidget } from "./MatrixWidget";
import { GatewayWidget } from "./GatewayWidget";
import { SessionsWidget } from "./SessionsWidget";
import { TokensWidget } from "./TokensWidget";
import { HostWidget } from "./HostWidget";
import { CronWidget } from "./CronWidget";
import { ErrorsWidget } from "./ErrorsWidget";
import { MoonWidget } from "./MoonWidget";
import { HeartbeatWidget } from "./HeartbeatWidget";
import { LifeWidget } from "./LifeWidget";
import { PomodoroWidget } from "./PomodoroWidget";
import { CountdownWidget } from "./CountdownWidget";
import { CalendarWidget } from "./CalendarWidget";

export interface WidgetRenderProps {
  data: HomeData;
  /** Per-widget persisted props (stored in the layout document). */
  widgetProps: Record<string, unknown>;
  onWidgetPropsChange: (next: Record<string, unknown>) => void;
  /** True while the home is in edit mode (lock open). Widgets use it to
   *  hard-disable in-widget interaction (e.g. drawing on the Life canvas)
   *  so it doesn't fight drag/resize. Hover controls themselves hide via CSS. */
  editing: boolean;
  /** The widget's current size in grid cells, live-updated during a resize.
   *  Lets a widget pick a discrete layout tier (e.g. the calendar). */
  gridSize: { gw: number; gh: number };
}

export interface WidgetDef {
  title: string;
  /** Renders with the full HomeData; each widget picks its slice. */
  component: ComponentType<WidgetRenderProps>;
  defaultSize: { gw: number; gh: number };
  minSize: { gw: number; gh: number };
  /** Route to navigate to on rest-mode click; null = decorative. */
  navigateTo: string | null;
  /** HomeData source whose failure puts the widget in error state. */
  dataSource: HomeDataSource | null;
}

/** Single registration point for home widgets. A future user-widget SDK
 *  plugs in here — nothing else in the home knows the widget list. */
export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  ascii: {
    title: "hermes",
    component: ({ data, widgetProps, onWidgetPropsChange }) => (
      <AsciiWidget
        status={data.status}
        widgetProps={widgetProps}
        onWidgetPropsChange={onWidgetPropsChange}
      />
    ),
    defaultSize: { gw: 3, gh: 6 }, minSize: { gw: 2, gh: 4 },
    navigateTo: null, dataSource: null,
  },
  clock: {
    title: "clock",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <ClockWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 5, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  matrix: {
    title: "matrix",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <MatrixWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 3, gh: 4 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  gateway: {
    title: "gateway",
    component: ({ data }) => <GatewayWidget status={data.status} />,
    defaultSize: { gw: 4, gh: 3 }, minSize: { gw: 3, gh: 2 },
    navigateTo: "/system", dataSource: "status",
  },
  sessions: {
    title: "sessions",
    component: ({ data }) => (
      <SessionsWidget status={data.status} sessions={data.sessions} />
    ),
    defaultSize: { gw: 3, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: "/sessions", dataSource: "sessions",
  },
  tokens: {
    title: "tokens",
    component: ({ data, widgetProps, onWidgetPropsChange }) => (
      <TokensWidget
        analytics={data.analytics}
        widgetProps={widgetProps}
        onWidgetPropsChange={onWidgetPropsChange}
      />
    ),
    defaultSize: { gw: 5, gh: 4 }, minSize: { gw: 3, gh: 3 },
    navigateTo: "/analytics", dataSource: "analytics",
  },
  host: {
    title: "host",
    component: ({ data, widgetProps, onWidgetPropsChange }) => (
      <HostWidget
        system={data.system}
        widgetProps={widgetProps}
        onWidgetPropsChange={onWidgetPropsChange}
      />
    ),
    defaultSize: { gw: 4, gh: 4 }, minSize: { gw: 3, gh: 3 },
    navigateTo: "/system", dataSource: "system",
  },
  cron: {
    title: "cron",
    component: ({ data }) => <CronWidget cron={data.cron} />,
    defaultSize: { gw: 3, gh: 3 }, minSize: { gw: 3, gh: 2 },
    navigateTo: "/cron", dataSource: "cron",
  },
  notes: {
    title: "notes",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <NotesWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 3, gh: 4 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  errors: {
    title: "errors",
    component: ({ data }) => <ErrorsWidget logs={data.logs} />,
    defaultSize: { gw: 3, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: "/logs", dataSource: "logs",
  },
  moon: {
    title: "moon",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <MoonWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 2, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  heartbeat: {
    title: "heartbeat",
    component: ({ data, widgetProps, onWidgetPropsChange }) => (
      <HeartbeatWidget
        status={data.status}
        widgetProps={widgetProps}
        onWidgetPropsChange={onWidgetPropsChange}
      />
    ),
    defaultSize: { gw: 4, gh: 2 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  life: {
    title: "life",
    component: ({ editing }) => <LifeWidget editing={editing} />,
    defaultSize: { gw: 3, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  pomodoro: {
    title: "pomodoro",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <PomodoroWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 3, gh: 3 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  countdown: {
    title: "countdown",
    component: ({ widgetProps, onWidgetPropsChange }) => (
      <CountdownWidget widgetProps={widgetProps} onWidgetPropsChange={onWidgetPropsChange} />
    ),
    defaultSize: { gw: 3, gh: 2 }, minSize: { gw: 2, gh: 2 },
    navigateTo: null, dataSource: null,
  },
  calendar: {
    title: "calendar",
    component: ({ gridSize }) => <CalendarWidget gridSize={gridSize} />,
    defaultSize: { gw: 3, gh: 4 }, minSize: { gw: 2, gh: 3 },
    navigateTo: null, dataSource: null,
  },
};
