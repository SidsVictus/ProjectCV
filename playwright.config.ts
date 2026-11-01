import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

// E2E against the real local Supabase stack and the R2 mock. Run `npm run build` first.
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/_scratch/**",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000", trace: "retain-on-failure",
    // Optional: a pre-installed Chromium (set PW_CHROMIUM_PATH) instead of Playwright's own download.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, grep: /@mobile/ },
  ],
  webServer: [
    { command: "node scripts/r2-mock.mjs", port: 4569, reuseExistingServer: true },
    { command: "npx next start -p 3000", url: "http://localhost:3000/legal/terms", reuseExistingServer: true, timeout: 120_000 },
  ],
});
