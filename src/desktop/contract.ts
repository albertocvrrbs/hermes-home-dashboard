import type { ReactNode } from "react";

export const HOME_DESKTOP_PATH = "/home";
export const BOARDS_DESKTOP_PATH = "/boards";

const DESKTOP_START_KEY = "home-dashboard.opened-this-start";

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface HomeContribution {
  id: string;
  area: string;
  title?: string;
  order: number;
  data: Record<string, unknown>;
  render?: () => ReactNode;
}

export interface HomeLabels {
  home: string;
  open: string;
}

const ENGLISH_LABELS: HomeLabels = { home: "Home", open: "Open Home" };

export function createHomeContributions(
  render: () => ReactNode,
  navigate: (path: string) => void = () => undefined,
  labels: HomeLabels = ENGLISH_LABELS,
): HomeContribution[] {
  return [
    {
      id: "page",
      area: "routes",
      title: labels.home,
      order: -1000,
      data: { path: HOME_DESKTOP_PATH },
      render,
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: -1000,
      data: { path: HOME_DESKTOP_PATH, label: labels.home, codicon: "home" },
    },
    {
      id: "open",
      area: "palette",
      order: -1000,
      data: {
        id: "home.open",
        label: labels.open,
        keywords: ["home", "dashboard", "widgets", labels.home.toLowerCase()],
        run: () => navigate(HOME_DESKTOP_PATH),
      },
    },
  ];
}

/** Desktop marks every auxiliary renderer (HUD, pop-out session, pop-out
 *  browser) with `?win=` before the hash. Those windows render a single
 *  surface, not the app shell, so they must never be sent to /home. */
export function isAuxiliaryDesktopWindow(search: string): boolean {
  try {
    return new URLSearchParams(search).has("win");
  } catch {
    return false;
  }
}

export function openHomeOnDesktopStart(
  storage: SessionStorageLike,
  navigate: (path: string) => void,
  search = "",
): boolean {
  if (isAuxiliaryDesktopWindow(search)) {
    return false;
  }

  if (storage.getItem(DESKTOP_START_KEY) === "1") {
    return false;
  }

  storage.setItem(DESKTOP_START_KEY, "1");
  navigate(HOME_DESKTOP_PATH);
  return true;
}

export interface BoardLabels {
  boards: string;
  open: string;
}

/** The Boards page (index and one board, `?id=`), its sidebar row and palette command. */
export function createBoardContributions(
  render: () => ReactNode,
  navigate: (path: string) => void = () => undefined,
  labels: BoardLabels = { boards: "Boards", open: "Open boards" },
): HomeContribution[] {
  return [
    { id: "boards-page", area: "routes", title: labels.boards, order: -990, data: { path: BOARDS_DESKTOP_PATH }, render },
    { id: "boards-nav", area: "sidebar.nav", order: -990, data: { path: BOARDS_DESKTOP_PATH, label: labels.boards, codicon: "layout" } },
    {
      id: "boards-open", area: "palette", order: -990,
      data: {
        id: "boards.open", label: labels.open,
        keywords: ["board", "boards", "canvas", "whiteboard", labels.boards.toLowerCase()],
        run: () => navigate(BOARDS_DESKTOP_PATH),
      },
    },
  ];
}
