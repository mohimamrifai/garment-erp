import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@garment.local", password: "password123" };

/** Tanggal ISO (yyyy-mm-dd) n hari dari hari ini. */
function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  // Permintaan autentikasi pertama setelah server start bisa lambat (cold start).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * Alur penuh F5: sales order → SPK → output 4 tahap → QC packing lolos →
 * barang jadi masuk → alokasi → surat jalan draf → posting → SO selesai,
 * ditutup dengan daftar pengiriman, laporan, dan dashboard.
 */
test("order-to-shipment: QC akhir, alokasi, surat jalan, dan laporan", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsAdmin(page);

  // 1) Sales order 5 unit Kaos Polo (varian ber-BOM).
  await page.goto("/sales/new");
  await page.getByLabel("Buyer").click();
  await page.getByRole("option", { name: /PT Maju Garmen Sejahtera/ }).click();
  await page.getByLabel("Tenggat", { exact: true }).fill(String(isoDateOffset(14)));
  await page.getByLabel("Varian").click();
  await page.getByRole("option", { name: /PRD-0001-M-HITAM/ }).click();
  await page.getByLabel("Kuantitas").fill("5");
  await page.getByLabel("Harga satuan (Rp)").fill("90000");
  await page.getByRole("button", { name: "Simpan Draf" }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+$/);
  const salesOrderUrl = page.url();
  const salesOrderNumber =
    (await page.getByRole("heading", { name: /^SO-\d{6}-\d{4}$/ }).textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Konfirmasi", exact: true })
    .click();
  await expect(
    page.getByText(new RegExp(`Sales order ${salesOrderNumber} dikonfirmasi\\.`)),
  ).toBeVisible();

  // 2) SPK untuk item tersebut.
  await page.goto("/production/new");
  await page.getByLabel("Item sales order").click();
  await page.getByRole("option", { name: new RegExp(salesOrderNumber) }).click();
  await expect(page.getByLabel("Target kuantitas")).toHaveValue("5");
  await page.getByLabel("Lini produksi").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Periksa Ketersediaan" }).click();
  await expect(page.getByText("Material cukup")).toBeVisible();
  await page.getByRole("button", { name: "Buat SPK" }).click();
  await expect(page).toHaveURL(/\/production\/[0-9a-f-]+$/);
  const spkNumber =
    (await page.getByRole("heading", { name: /^SPK-\d{6}-\d{4}$/ }).textContent())?.trim() ?? "";
  expect(spkNumber).toMatch(/^SPK-\d{6}-\d{4}$/);

  // 3) Catat output 5 unit lolos pada keempat tahap.
  for (const stageLabel of ["Cutting", "Sewing", "Finishing", "Packing"]) {
    const stageCard = page
      .getByRole("heading", { name: stageLabel, exact: true })
      .locator("xpath=ancestor::section[1]");
    await stageCard.getByRole("button", { name: "Catat Output" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Kuantitas diproses").fill("5");
    await dialog.getByLabel("Kuantitas cacat").fill("0");
    await dialog.getByRole("button", { name: "Catat Output" }).click();
    await expect(
      page.getByText(new RegExp(`Output ${stageLabel} untuk ${spkNumber}`)),
    ).toBeVisible();
    // Muat ulang agar kartu tahap berikutnya memakai angka terbaru.
    await page.reload();
  }

  // 4) QC akhir (packing) lolos → barang jadi otomatis masuk.
  await page.goto("/qc/new");
  await page.getByLabel("Tahap produksi").click();
  await page
    .getByRole("option", { name: new RegExp(`${spkNumber}.*Packing`) })
    .click();
  await expect(page.getByLabel("Diperiksa")).toHaveValue("5");
  await page.getByLabel("Hasil inspeksi").click();
  await page.getByRole("option", { name: "Lolos", exact: true }).click();
  await page.getByRole("button", { name: "Simpan Inspeksi" }).click();
  await expect(page).toHaveURL(/\/qc\/[0-9a-f-]+$/);
  const qcNumber =
    (await page.getByRole("heading", { name: /^QC-\d{6}-\d{4}$/ }).textContent())?.trim() ?? "";

  // 5) Barang jadi tampil beserta lot yang tertaut ke inspeksi QC akhir.
  await page.goto("/finished-goods");
  await expect(page.getByRole("heading", { name: "Barang Jadi" })).toBeVisible();
  await expect(page.getByRole("link", { name: qcNumber })).toBeVisible();
  await expect(page.getByText(/lot barang jadi terbaru/i)).toBeVisible();

  // 6) Alokasikan 5 unit dari detail SO.
  await page.goto(salesOrderUrl);
  await expect(page.getByText("Pemenuhan & Pengiriman", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alokasikan", exact: true }).first().click();
  const allocationDialog = page.getByRole("dialog");
  await expect(allocationDialog.getByLabel("Kuantitas")).toHaveValue("5");
  await allocationDialog.getByRole("button", { name: "Alokasikan", exact: true }).click();
  await expect(page.getByText(/Alokasi 5 unit untuk PRD-0001-M-HITAM/)).toBeVisible();
  await expect(page.getByText("Siap Kirim", { exact: true }).first()).toBeVisible();

  // 7) Buat surat jalan dari detail SO (kuantitas terisi otomatis).
  await page.getByRole("button", { name: "Buat Pengiriman" }).click();
  await expect(page).toHaveURL(/\/shipping\/new\?so=/);
  await expect(page.getByLabel("Kuantitas kirim PRD-0001-M-HITAM")).toHaveValue("5");
  await page.getByRole("button", { name: "Simpan Draf" }).click();
  await expect(page).toHaveURL(/\/shipping\/[0-9a-f-]+$/);
  const shipmentNumber =
    (await page.getByRole("heading", { name: /^SJ-\d{6}-\d{4}$/ }).textContent())?.trim() ?? "";
  expect(shipmentNumber).toMatch(/^SJ-\d{6}-\d{4}$/);
  await expect(page.getByText("Draf", { exact: true }).first()).toBeVisible();

  // 8) Posting surat jalan → stok barang jadi berkurang.
  await page.getByRole("button", { name: "Posting Pengiriman" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Posting", exact: true })
    .click();
  await expect(
    page.getByText(new RegExp(`Pengiriman ${shipmentNumber} diposting`)),
  ).toBeVisible();
  await expect(page.getByText("Diposting", { exact: true }).first()).toBeVisible();

  // 9) Kembali ke SO: selesai dan riwayat pengiriman tercatat.
  await page.goto(salesOrderUrl);
  await expect(page.getByText("Selesai", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: shipmentNumber })).toBeVisible();

  // 10) Daftar pengiriman, laporan (termasuk ekspor CSV), dan dashboard.
  await page.goto("/shipping");
  await expect(page.getByRole("link", { name: shipmentNumber })).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("button", { name: "Ekspor CSV" })).toBeVisible();
  await page.getByRole("button", { name: "Barang Jadi & Pengiriman" }).click();
  await expect(page).toHaveURL(/report=fg-shipments/);
  await expect(page.getByRole("columnheader", { name: "Nomor SJ" })).toBeVisible();
  await expect(page.getByRole("cell", { name: shipmentNumber })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ekspor CSV" })).toHaveAttribute(
    "href",
    /report=fg-shipments/,
  );

  await page.goto("/dashboard");
  await expect(page.getByText("Output packing per hari")).toBeVisible();
  await page.getByRole("link", { name: "7 hari" }).click();
  await expect(page).toHaveURL(/period=7/);
  await expect(page.getByText("Barang Jadi & Pengiriman")).toBeVisible();
});
