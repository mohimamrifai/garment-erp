import { expect, test } from "@playwright/test";

const PRODUKSI = { email: "produksi@garment.local", password: "password123" };
const ADMIN = { email: "admin@garment.local", password: "password123" };

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

test("daftar SPK dan QC menampilkan data seed beserta filternya", async ({ page }) => {
  await loginAs(page, PRODUKSI);

  // Daftar SPK seed dengan filter status.
  await page.goto("/production");
  await expect(page.getByRole("link", { name: /^SPK-\d{6}-\d{4}$/ }).first()).toBeVisible();

  await page.getByLabel("Filter status SPK").click();
  await page.getByRole("option", { name: "Berjalan", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Berjalan" }).first()).toBeVisible();

  // Detail SPK seed: kebutuhan material, pemakaian, dan tahapan.
  await page.goto("/production");
  const firstSpk = page.getByRole("link", { name: /^SPK-\d{6}-\d{4}$/ }).first();
  const spkNumber = ((await firstSpk.textContent()) ?? "").trim();
  await firstSpk.click();
  await expect(page.getByRole("heading", { name: spkNumber })).toBeVisible();
  await expect(page.getByRole("heading", { name: /kebutuhan material/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /pemakaian material/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /tahapan produksi/i })).toBeVisible();

  // Daftar inspeksi QC dengan filter hasil.
  await page.goto("/qc");
  await expect(page.getByRole("link", { name: /^QC-\d{6}-\d{4}$/ }).first()).toBeVisible();

  await page.getByLabel("Filter hasil inspeksi").click();
  await page.getByRole("option", { name: "Rework", exact: true }).click();
  await expect(page.getByRole("cell", { name: /^Rework/ }).first()).toBeVisible();
});

test("produksi membuat SPK, mencatat output, mencatat pemakaian, lalu inspeksi QC", async ({
  page,
}) => {
  await loginAs(page, ADMIN);

  // 1) SO terkonfirmasi 5 unit varian ber-BOM (Kaos Polo Basic M/Hitam).
  await page.goto("/sales/new");
  await page.getByLabel("Buyer").click();
  await page.getByRole("option", { name: /PT Maju Garmen Sejahtera/ }).click();
  await page.getByLabel("Tenggat", { exact: true }).fill(isoDateOffset(14));
  await page.getByLabel("Varian").click();
  await page.getByRole("option", { name: /PRD-0001-M-HITAM/ }).click();
  await page.getByLabel("Kuantitas").fill("5");
  await page.getByLabel("Harga satuan (Rp)").fill("90000");
  await page.getByRole("button", { name: "Simpan Draf" }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+$/);

  const soNumber =
    (await page.getByRole("heading", { name: /^SO-\d{6}-\d{4}$/ }).textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Konfirmasi", exact: true })
    .click();
  await expect(page.getByText(new RegExp(`Sales order ${soNumber} dikonfirmasi\\.`))).toBeVisible();

  // 2) Buat SPK dari item SO tersebut; gate ketersediaan harus "Material cukup".
  await page.goto("/production/new");
  await page.getByLabel("Item sales order").click();
  await page.getByRole("option", { name: new RegExp(soNumber) }).click();
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
  await expect(page.getByText("Terbuka", { exact: true }).first()).toBeVisible();

  // 3) Catat output tahap cutting: 5 diproses, 5 lolos.
  await page.getByRole("button", { name: "Catat Output" }).first().click();
  const outputDialog = page.getByRole("dialog");
  await outputDialog.getByLabel("Kuantitas diproses").fill("5");
  await outputDialog.getByLabel("Kuantitas cacat").fill("0");
  await outputDialog.getByRole("button", { name: "Catat Output" }).click();
  await expect(page.getByText(new RegExp(`Output Cutting untuk ${spkNumber}`))).toBeVisible();
  await expect(page.getByText("Berjalan", { exact: true }).first()).toBeVisible();

  // 4) Catat pemakaian material dari gudang kain; kancing diambil dari gudang lain
  //    sehingga dikosongkan agar stok lokasi ini cukup.
  await page.getByRole("button", { name: "Catat Pemakaian" }).click();
  const issueDialog = page.getByRole("dialog");
  await issueDialog.getByLabel("Lokasi pengambilan").click();
  await page.getByRole("option", { name: /A-01/ }).click();
  await issueDialog.getByLabel("Kuantitas Kancing Plastik 18L").fill("0");
  await issueDialog.getByRole("button", { name: "Catat Pemakaian" }).click();
  await expect(page.getByText(new RegExp(`Pemakaian material untuk ${spkNumber}`))).toBeVisible();
  await expect(page.getByText(/^MIS-\d{6}-\d{4}$/).first()).toBeVisible();

  // 5) Inspeksi QC untuk output cutting: 5 diperiksa, semuanya lolos.
  await page.goto("/qc/new");
  await page.getByLabel("Tahap produksi").click();
  await page.getByRole("option", { name: new RegExp(spkNumber) }).click();
  await expect(page.getByLabel("Diperiksa")).toHaveValue("5");
  await page.getByLabel("Hasil inspeksi").click();
  await page.getByRole("option", { name: "Lolos", exact: true }).click();
  await page.getByRole("button", { name: "Simpan Inspeksi" }).click();

  await expect(page).toHaveURL(/\/qc\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: /^QC-\d{6}-\d{4}$/ })).toBeVisible();
  await expect(page.getByText("Lolos", { exact: true }).first()).toBeVisible();
});
