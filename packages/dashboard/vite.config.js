import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [preact()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: "index.html",
    },
  },
});
