import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results/website",
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:1431",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run build:website && vite preview --config website/vite.config.ts --host 127.0.0.1 --port 1431 --strictPort",
    cwd: "..",
    url: "http://127.0.0.1:1431",
    reuseExistingServer: false,
  },
});
