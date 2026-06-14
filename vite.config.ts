import { defineConfig } from "vite";
import path from "path";

// Builds the home dashboard as a single IIFE bundle that the Hermes host
// loads at runtime. React (and the JSX runtime) are NOT bundled — they are
// aliased to thin shims that read window.__HERMES_PLUGIN_SDK__.React, so the
// plugin shares the host's single React instance (required for hooks to work
// inside the host's render tree).
export default defineConfig({
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, "src/shims/jsx-runtime.js") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, "src/shims/jsx-runtime.js") },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, "src/shims/react.js") },
      { find: /^react$/, replacement: path.resolve(__dirname, "src/shims/react.js") },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      formats: ["iife"],
      name: "HermesHomePlugin",
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: { assetFileNames: "style.css" },
    },
  },
});
