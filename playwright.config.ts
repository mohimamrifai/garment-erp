import { defineConfig, devices } from "@playwright/test";

/**
 * E2E memakai database dev yang sudah di-seed (`pnpm db:seed`).
 * Bila dev server sudah berjalan di port 3000, Playwright memakainya kembali.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Dev server mengompilasi rute saat pertama diakses — beri ruang lebih dari 5 dtk.
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "id-ID",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // E2E berjalan terhadap build produksi (lebih stabil dan merepresentasikan
        // perilaku `next start`). Jalankan `pnpm build` dulu bila belum ada,
        // dan pastikan tidak ada dev server di port 3000.
        command: "pnpm start",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Banyak login cepat dalam satu IP akan kena rate limit Better Auth
        // (3 percobaan / 10 detik untuk /sign-in) — matikan khusus E2E.
        env: { E2E_DISABLE_RATE_LIMIT: "1" },
      },
});
