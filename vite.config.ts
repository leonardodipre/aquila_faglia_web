import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  publicDir: "data",
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@react-three/drei") || id.includes("three-stdlib") || id.includes("maath")) {
            return "drei-vendor";
          }
          if (id.includes("@react-three/fiber")) {
            return "fiber-vendor";
          }
          if (id.includes("/three/")) {
            return "three-core";
          }
          if (id.includes("leaflet")) {
            return "map-vendor";
          }
          if (id.includes("react-router-dom")) {
            return "router-vendor";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./test-support/setupTests.ts",
    css: true,
  },
});
