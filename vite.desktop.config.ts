import { defineConfig } from "vite";
import path from "path";

// Hermes Desktop loads one plain ESM file from
// ~/.hermes/desktop-plugins/home-dashboard/plugin.js.  React and the Desktop
// plugin SDK must stay external so the runtime loader can bind them to the
// application's live singletons.
export default defineConfig({
  resolve: {
    // "@/x" resolves to "src/x": one root-relative path instead of deep relative chains.
    alias: [{ find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" }],
  },
  build: {
    outDir: "desktop",
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/desktop/index.tsx"),
      formats: ["es"],
      fileName: () => "plugin.js",
    },
    rollupOptions: {
      external: ["@hermes/plugin-sdk", "react", "react/jsx-runtime"],
    },
  },
});
