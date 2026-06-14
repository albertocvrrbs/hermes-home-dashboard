// Entry point: register the Home dashboard component with the Hermes host.
import HomePage from "./home/HomePage";
import "./home/home.css";

const registry = window.__HERMES_PLUGINS__;
if (registry) {
  registry.register("home-dashboard", HomePage);
} else {
  // eslint-disable-next-line no-console
  console.error("[home-dashboard] __HERMES_PLUGINS__ registry not found");
}
