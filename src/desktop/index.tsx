import {
  host,
  type HermesPlugin,
  type PluginContext,
} from "@hermes/plugin-sdk";

import HomePage from "../home/HomePage";
import homeCss from "../home/home.css?inline";
import { configureHomeHost } from "../sdk";
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

const plugin: HermesPlugin = {
  id: "home-dashboard",
  name: "Home",
  defaultEnabled: true,
  register(ctx: PluginContext) {
    configureHomeHost(createDesktopHomeHost(ctx, host));
    ctx.registerMany(
      createHomeContributions(
        () => <DesktopHomePage />,
        (path) => host.navigate(path),
      ),
    );

    // Runtime plugins arrive just after the shell mounts.  Defer one task so
    // the contributed /home route exists before making it the startup page.
    window.setTimeout(() => {
      openHomeOnDesktopStart(window.sessionStorage, (path) => host.navigate(path));
    }, 0);
  },
};

export default plugin;
