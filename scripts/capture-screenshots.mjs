import { mkdir } from "node:fs/promises";
import { chromium, request as playwrightRequest } from "@playwright/test";

/**
 * Menangkap screenshot halaman utama untuk README/portofolio.
 *
 * Prasyarat: build produksi berjalan di `E2E_BASE_URL` (default
 * http://localhost:3000) dan database sudah di-seed (`pnpm db:seed`).
 *
 * Pemakaian:
 *   pnpm build && pnpm start &   # atau reuse server yang sudah jalan
 *   node scripts/capture-screenshots.mjs
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const outputDir = new URL("../docs/screenshots/", import.meta.url).pathname;
const ADMIN = { email: "admin@garment.local", password: "password123" };
const VIEWPORT = { width: 1440, height: 900 };

async function main() {
  await mkdir(outputDir, { recursive: true });

  const api = await playwrightRequest.newContext({ baseURL });
  const login = await api.post("/api/auth/sign-in/email", { data: ADMIN });
  if (!login.ok()) throw new Error(`Gagal masuk sebagai admin: ${login.status()}`);

  const salesOrderId = await findId(api, "/api/v1/sales-orders?query=SO-202610-0003");
  const productionOrderId = await findId(api, "/api/v1/production-orders?query=SPK-202610-0001");
  const shipmentId = await findId(api, "/api/v1/shipments?query=SJ-202610-0001");

  const browser = await chromium.launch();

  // Halaman login tanpa sesi (konteks terpisah).
  const anonymous = await browser.newContext({ baseURL, viewport: VIEWPORT, locale: "id-ID" });
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto("/login");
  await anonymousPage.waitForLoadState("networkidle");
  await anonymousPage.screenshot({ path: `${outputDir}01-login.png` });
  await anonymous.close();

  const context = await browser.newContext({
    baseURL,
    viewport: VIEWPORT,
    locale: "id-ID",
    storageState: await api.storageState(),
  });
  const page = await context.newPage();

  const targets = [
    { file: "02-dashboard.png", path: "/dashboard" },
    { file: "03-sales-orders.png", path: "/sales" },
    { file: "04-sales-order-detail.png", path: `/sales/${salesOrderId}` },
    { file: "05-production-order.png", path: `/production/${productionOrderId}` },
    { file: "06-quality-control.png", path: "/qc" },
    { file: "07-inventory.png", path: "/inventory" },
    { file: "08-finished-goods.png", path: "/finished-goods" },
    { file: "09-shipping.png", path: "/shipping" },
    { file: "10-shipment-detail.png", path: `/shipping/${shipmentId}` },
    { file: "11-reports.png", path: "/reports" },
    { file: "12-users.png", path: "/settings/users" },
    { file: "13-audit-log.png", path: "/settings/audit" },
    { file: "14-docs.png", path: "/docs" },
    { file: "15-asisten-ai.png", path: "/asisten-ai" },
  ];

  for (const target of targets) {
    await page.goto(target.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400); // beri waktu chart/animasi stabil
    await page.screenshot({ path: `${outputDir}${target.file}` });
    console.log(`✓ ${target.file} (${target.path})`);
  }

  await context.close();
  await browser.close();
  await api.dispose();
  console.log(`Selesai. Screenshot tersimpan di ${outputDir}`);
}

async function findId(api, path) {
  const url = new URL(path, baseURL);
  url.searchParams.set("pageSize", "1");
  const response = await api.get(`${url.pathname}${url.search}`);
  const body = await response.json();
  const row = body.data?.[0];
  if (!row) throw new Error(`Data tidak ditemukan: ${path}`);
  return row.id;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
