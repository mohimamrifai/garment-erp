import { expect, test } from "@playwright/test";

const SALES = { email: "sales@garment.local", password: "password123" };

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SALES.email);
  await page.getByLabel("Password").fill(SALES.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("admin sales membuat buyer baru lewat form", async ({ page }) => {
  const uniqueName = `PT E2E ${Date.now()}`;

  await page.goto("/buyers");
  await page.getByRole("button", { name: "Tambah Buyer" }).click();
  await page.getByLabel("Nama buyer").fill(uniqueName);
  await page.getByLabel("Kontak person").fill("Penguji Otomatis");
  await page.getByLabel("Telepon").fill("021-1234567");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByText(/berhasil dibuat/)).toBeVisible();

  await page.getByLabel("Cari buyer").fill(uniqueName);
  await page.getByLabel("Cari buyer").press("Enter");
  await expect(page.getByRole("cell", { name: uniqueName, exact: true })).toBeVisible();
});

test("pencarian buyer menyaring daftar", async ({ page }) => {
  await page.goto("/buyers");
  await expect(page.getByText("PT Maju Garmen Sejahtera")).toBeVisible();

  await page.getByLabel("Cari buyer").fill("Tidak Ada Hasil Ini");
  await page.getByLabel("Cari buyer").press("Enter");
  await expect(page.getByText("Belum ada buyer")).toBeVisible();
});

test("menonaktifkan buyer lewat aksi baris", async ({ page }) => {
  const uniqueName = `PT E2E Nonaktif ${Date.now()}`;

  // Buat buyer lewat API memakai sesi browser (lebih cepat & stabil).
  const created = await page.request.post("/api/v1/buyers", { data: { name: uniqueName } });
  expect(created.ok()).toBeTruthy();

  await page.goto("/buyers");
  await page.getByLabel("Cari buyer").fill(uniqueName);
  await page.getByLabel("Cari buyer").press("Enter");

  const row = page.getByRole("row", { name: uniqueName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Aksi untuk/ }).click();
  await page.getByRole("menuitem", { name: "Nonaktifkan" }).click();
  await page.getByRole("button", { name: "Nonaktifkan" }).click();

  await expect(page.getByText("Buyer dinonaktifkan.")).toBeVisible();
  await expect(page.getByRole("row", { name: uniqueName }).getByText("Nonaktif")).toBeVisible();
});
