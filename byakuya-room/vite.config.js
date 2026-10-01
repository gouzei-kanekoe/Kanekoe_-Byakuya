import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // A single module entry needs no preload helper, so the page ships only this project's code.
  build: { modulePreload: { polyfill: false }, rolldownOptions: { input: "room.source.html" } },
});
