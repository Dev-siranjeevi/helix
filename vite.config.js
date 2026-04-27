import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { protocol: "ws", host: "localhost", port: 5173 },
    fs: { allow: [".."] },
    headers: { "Access-Control-Allow-Origin": "*" },
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Target Electron 33's Chromium version (Chrome 130)
    target: "chrome130",
    rollupOptions: {
      // electron is provided by the Electron runtime — never bundle it
      external: ["electron"],
      output: {
        manualChunks(id) {
          // All react* packages → one shared chunk so there is exactly one
          // React runtime in the entire renderer bundle.
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // pdf-lib into its own lazy chunk — only loaded when PDF tab is opened
          if (id.includes("/node_modules/pdf-lib/")) {
            return "vendor-pdf-lib";
          }
        },
      },
    },
  },
  resolve: {
    // Force Vite to resolve a single copy of react and react-dom
    // even if multiple packages try to require them.
    dedupe: ["react", "react-dom"],
    alias: {
      // Ensure electron imports are never bundled into the renderer
      electron: path.resolve("./src/_empty.js"),
    },
  },
  optimizeDeps: {
    exclude: ["electron"],
    include: ["react", "react-dom"],
  },
});
