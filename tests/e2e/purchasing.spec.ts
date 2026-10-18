import { expect, test } from "@playwright/test";

const PURCHASING = { email: "purchasing@garment.local", password: "password123" };
const WAREHOUSE = { email: "warehouse@garment.local", password: "password123" };

/** Tanggal ISO (yyyy-mm-dd) n hari dari hari ini. */
function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function loginAs(
  page: import("@playwright/test").Page,
  account: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("purchasing membuat PO, memesan, menerima, lalu memposting ke stok", async ({ page }) => {
  await loginAs(page, PURCHASING);

  // Buat PO draf.
  await page.goto("/purchasing/new");
  await page.getByLabel("Supplier").click();
  await page.getByRole("option", { name: /PT Sumber Benang Jaya/ }).click();
  await page.getByLabel("Estimasi datang").fill(isoDateOffset(7));

  await page.getByLabel("Material").click();
  await page.getByRole("option", { name: /Kain Katun Combed 30s/ }).click();
  await page.getByLabel("Kuantitas").fill("50");
  await page.getByLabel("Harga beli satuan (Rp)").fill("88000");

  await page.getByRole("button", { name: "Simpan Draf" }).click();

  await expect(page).toHaveURL(/\/purchasing\/[0-9a-f-]+$/);
  await expect(page.getByText(/Purchase order PO-\d{6}-\d{4} dibuat sebagai draf\./)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^PO-\d{6}-\d{4}$/ })).toBeVisible();
  await expect(page.getByText("Draf", { exact: true })).toBeVisible();

  // Pesan ke supplier.
  await page.getByRole("button", { name: "Pesan ke Supplier" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Pesan", exact: true })
    .click();
  await expect(page.getByText(/dipesan ke supplier\./)).toBeVisible();
  await expect(page.getByText("Dipesan", { exact: true }).first()).toBeVisible();

  // Terima barang: form terisi otomatis sisa pesanan.
  await page.getByRole("link", { name: "Terima Barang" }).click();
  await expect(page).toHaveURL(/\/purchasing\/receipts\/new\?po=/);
  await expect(page.getByRole("heading", { name: "Item Diterima" })).toBeVisible();
  await expect(page.getByText("Kain Katun Combed 30s", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Lokasi penyimpanan").click();
  await page.getByRole("option", { name: /Gudang Utama — A-01/ }).click();
  await page.getByRole("button", { name: "Simpan Draf" }).click();

  await expect(page).toHaveURL(/\/purchasing\/receipts\/[0-9a-f-]+$/);
  await expect(page.getByText(/Penerimaan RCV-\d{6}-\d{4} dibuat sebagai draf\./)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^RCV-\d{6}-\d{4}$/ })).toBeVisible();

  // Posting: stok bertambah dan dokumen terkunci.
  await page.getByRole("button", { name: "Posting", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Posting", exact: true })
    .click();
  await expect(page.getByText(/diposting — stok bertambah\./)).toBeVisible();
  await expect(page.getByText("Diposting", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Posting", exact: true })).toHaveCount(0);

  // Mutasi stok tercatat untuk penerimaan ini.
  await expect(page.getByRole("heading", { name: "Mutasi Stok" })).toBeVisible();
  await expect(page.getByText(/^TRX-\d{6}-\d{4}$/).first()).toBeVisible();

  // PO kini berstatus diterima lengkap.
  await page.getByRole("link", { name: /^PO-\d{6}-\d{4}$/ }).first().click();
  await expect(page.getByText(/^Diterima Lengkap$/).first()).toBeVisible();
});

test("daftar PO menampilkan data seed dan memfilter status", async ({ page }) => {
  await loginAs(page, PURCHASING);
  await page.goto("/purchasing");

  await expect(page.getByText(/^PO-\d{6}-\d{4}$/).first()).toBeVisible();

  await page.getByLabel("Filter status purchase order").click();
  await page.getByRole("option", { name: "Diterima Sebagian" }).click();

  await expect(page.getByText("Diterima Sebagian", { exact: true }).first()).toBeVisible();
});

test("gudang mencatat transfer stok dan penyesuaian dari halaman inventori", async ({ page }) => {
  await loginAs(page, WAREHOUSE);
  await page.goto("/inventory");

  // Transfer antar lokasi.
  await page.getByRole("button", { name: "Transfer Stok" }).click();
  await page.getByLabel("Material").click();
  await page.getByRole("option", { name: /Kain Katun Combed 30s/ }).click();
  await page.getByLabel("Lokasi asal").click();
  await page.getByRole("option", { name: /Gudang Utama — A-01/ }).click();
  await page.getByLabel("Lokasi tujuan").click();
  await page.getByRole("option", { name: /Gudang Utama — A-02/ }).click();
  await page.getByLabel("Kuantitas").fill("1");
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await expect(page.getByText("Transfer stok tercatat.")).toBeVisible();

  // Penyesuaian masuk dengan alasan.
  await page.getByRole("button", { name: "Penyesuaian Stok" }).click();
  await page.getByLabel("Material").click();
  await page.getByRole("option", { name: /Kancing Plastik 18L/ }).click();
  await page.getByLabel("Lokasi", { exact: true }).click();
  await page.getByRole("option", { name: /Gudang Aksesori — C-01/ }).click();
  await page.getByLabel("Kuantitas").fill("1");
  await page.getByLabel("Alasan").fill("Uji E2E penyesuaian stok");
  await page.getByRole("button", { name: "Catat Penyesuaian" }).click();
  await expect(page.getByText("Penyesuaian stok tercatat.")).toBeVisible();

  // Riwayat mutasi menampilkan kedua jenis transaksi.
  await page.goto("/inventory/movements");
  await expect(page.getByText("Transfer", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Penyesuaian Masuk", { exact: true }).first()).toBeVisible();
});
