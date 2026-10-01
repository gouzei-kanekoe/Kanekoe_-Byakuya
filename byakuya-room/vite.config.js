import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { rolldownOptions: { input: "room.source.html" } },
});
