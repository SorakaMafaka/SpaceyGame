import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      "https://sorakamafaka.github.io/SpaceyGame/",
    headless: true,
  },
  timeout: 45000,
});
