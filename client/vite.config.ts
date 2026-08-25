import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // La carte et ses dépendances ne doivent jamais entrer dans le bundle
        // initial des pages éditoriales (§9, §13).
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/leaflet|@turf/.test(id)) return "carto";
            if (/react-dom|react-router|@tanstack/.test(id)) return "framework";
          }
          return undefined;
        },
      },
    },
  },
});
