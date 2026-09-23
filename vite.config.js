import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: { main: "index.html", simulation: "src/simulation.js" },
      preserveEntrySignatures: "strict",
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "simulation"
            ? "assets/simulation.js"
            : "assets/[name]-[hash].js",
      },
    },
  },
});
