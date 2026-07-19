import type { ReactNode } from "react";

export const HOME_DESKTOP_PATH = "/home";

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

export function createHomeContributions(
  render: () => ReactNode,
  navigate: (path: string) => void = () => undefined,
): HomeContribution[] {
  return [
    {
      id: "page",
      area: "routes",
      title: "Home",
      order: -1000,
      data: { path: HOME_DESKTOP_PATH },
      render,
    },
    {
      id: "nav",
      area: "sidebar.nav",
      order: -1000,
      data: { path: HOME_DESKTOP_PATH, label: "Home", codicon: "home" },
    },
    {
      id: "open",
      area: "palette",
      order: -1000,
      data: {
        id: "home.open",
        label: "Open Home",
        keywords: ["home", "dashboard", "widgets"],
        run: () => navigate(HOME_DESKTOP_PATH),
      },
    },
  ];
}

export function openHomeOnDesktopStart(
  storage: SessionStorageLike,
  navigate: (path: string) => void,
): boolean {
  if (storage.getItem(DESKTOP_START_KEY) === "1") {
    return false;
  }

  storage.setItem(DESKTOP_START_KEY, "1");
  navigate(HOME_DESKTOP_PATH);
  return true;
}
