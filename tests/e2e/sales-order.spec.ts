import { expect, test } from "@playwright/test";

const SALES = { email: "sales@garment.local", password: "password123" };

/** Tanggal ISO (yyyy-mm-dd) n hari dari hari ini. */
function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SALES.email);
  await page.getByLabel("Password").fill(SALES.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("sales membuat SO lalu mengonfirmasi dan membatalkannya", async ({ page }) => {
  await page.goto("/sales/new");

  // Buyer & tanggal.
  await page.getByLabel("Buyer").click();
  await page.getByRole("option", { name: /PT Maju Garmen Sejahtera/ }).click();
  await page.getByLabel("Tenggat", { exact: true }).fill(isoDateOffset(14));

  // Item pertama.
  await page.getByLabel("Varian").click();
  await page.getByRole("option", { name: /Kaos Polo Basic/ }).first().click();
  await page.getByLabel("Kuantitas").fill("25");
  await page.getByLabel("Harga satuan (Rp)").fill("90000");

  await page.getByRole("button", { name: "Simpan Draf" }).click();

  // Detail SO: nomor + status draf.
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+$/);
  await expect(page.getByText(/Sales order SO-\d{6}-\d{4} dibuat sebagai draf\./)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^SO-\d{6}-\d{4}$/ })).toBeVisible();
  await expect(page.getByText("Draf", { exact: true })).toBeVisible();

  // Konfirmasi.
  await page.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Konfirmasi", exact: true })
    .click();
  await expect(page.getByText(/Sales order SO-\d{6}-\d{4} dikonfirmasi\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Konfirmasi", exact: true })).toHaveCount(0);
  await expect(page.getByText("Dikonfirmasi", { exact: true }).first()).toBeVisible();

  // Batalkan dengan alasan.
  await page.getByRole("button", { name: "Batalkan", exact: true }).click();
  await page.getByLabel("Alasan pembatalan").fill("Buyer menunda produksi (uji E2E)");
  await page.getByRole("button", { name: "Batalkan Pesanan" }).click();
  await expect(page.getByText(/Sales order SO-\d{6}-\d{4} dibatalkan\./)).toBeVisible();
  await expect(page.getByText("Pesanan dibatalkan.", { exact: true })).toBeVisible();
});

test("daftar SO menampilkan pesanan seed dan memfilter status", async ({ page }) => {
  await page.goto("/sales");

  await expect(page.getByText(/^SO-\d{6}-\d{4}$/).first()).toBeVisible();

  await page.getByLabel("Filter status sales order").click();
  await page.getByRole("option", { name: "Dibatalkan" }).click();

  await expect(page.getByRole("cell", { name: "Dibatalkan" }).first()).toBeVisible();
});
