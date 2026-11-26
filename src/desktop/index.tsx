import {
  host,
  type HermesPlugin,
  type PluginContext,
} from "@hermes/plugin-sdk";

import HomePage from "../home/HomePage";
import homeCss from "../home/home.css?inline";
import { configureHomeHost } from "../sdk";
import { LANGUAGES, setHostLanguage, t } from "../home/i18n";
import {
  createHomeContributions,
  openHomeOnDesktopStart,
} from "./contract";
import { createDesktopHomeHost } from "./host";

function DesktopHomePage() {
  return (
    <>
      <style>{homeCss}</style>
      <HomePage />
    </>
  );
}

const LANGUAGE_PROBE = "home.language";

/** Follow the app's `display.language`. The SDK exposes the active locale
 *  only through translation, so register one probe string per language we
 *  ship (its value is the language id) and read it back: the app resolves it
 *  for its current locale and falls back to our "en" bundle for languages we
 *  don't ship. Older Desktop builds have no `ctx.i18n`; the browser's
 *  languages are used there. */
function followDesktopLanguage(ctx: PluginContext): void {
  const i18n = ctx.i18n;
  if (!i18n || typeof i18n.register !== "function" || typeof i18n.t !== "function") return;
  try {
    i18n.register(Object.fromEntries(LANGUAGES.map((id) => [id, { [LANGUAGE_PROBE]: id }])));
    const sync = () => {
      const value = i18n.t(LANGUAGE_PROBE);
      setHostLanguage(value && value !== LANGUAGE_PROBE ? value : null);
    };
    sync();
    i18n.onLocaleChange?.(sync);
  } catch {
    // Never let language detection break the Home page.
  }
}

const plugin: HermesPlugin = {
  id: "home-dashboard",
  name: "Home",
  defaultEnabled: true,
  register(ctx: PluginContext) {
    configureHomeHost(createDesktopHomeHost(ctx, host));
    followDesktopLanguage(ctx);
    ctx.registerMany(
      createHomeContributions(
        () => <DesktopHomePage />,
        (path) => host.navigate(path),
        // Sidebar / palette labels are registered once, in the language
        // active at load time.
        { home: t("nav.home"), open: t("nav.open") },
      ),
    );

    // Runtime plugins arrive just after the shell mounts.  Defer one task so
    // the contributed /home route exists before making it the startup page.
    window.setTimeout(() => {
      openHomeOnDesktopStart(
        window.sessionStorage,
        (path) => host.navigate(path),
        window.location.search,
      );
    }, 0);
  },
};

export default plugin;
