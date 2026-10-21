import { expect, test, type Page } from "@playwright/test";
import { expectSidebarLink, sidebarOf } from "./helpers/sidebar";

const ADMIN = { email: "admin@garment.local", password: "password123" };
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN.email, ADMIN.password);
  // Permintaan autentikasi pertama setelah server start bisa lambat (cold start).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}

/** F6.1 — alur manajemen pengguna penuh oleh Administrator. */
test("admin membuat, menonaktifkan, dan mengaktifkan kembali pengguna", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const name = `Pengguna E2E ${stamp}`;
  const email = `e2e.${stamp}@garment.local`;

  await loginAsAdmin(page);
  await page.goto("/settings/users");
  await expect(page.getByRole("heading", { name: "Pengguna", exact: true })).toBeVisible();

  // 1) Buat pengguna baru dengan role Sales.
  await page.getByRole("button", { name: "Tambah Pengguna" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Nama").fill(name);
  await createDialog.getByLabel("Email").fill(email);
  await createDialog.getByLabel("Password awal").fill("password123");
  // Role Sales terpilih secara default pada dialog.
  await expect(createDialog.getByRole("checkbox", { name: "Sales", exact: true })).toBeChecked();
  await createDialog.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Pengguna berhasil dibuat.")).toBeVisible();

  // 2) Cari pengguna baru dan pastikan role Sales tersimpan.
  await page.getByLabel("Cari pengguna").fill(email);
  await page.getByLabel("Cari pengguna").press("Enter");
  let row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toBeVisible();
  await expect(row.getByText("Sales", { exact: true })).toBeVisible();

  // 3) Nonaktifkan pengguna.
  await row.getByRole("button", { name: `Aksi untuk ${name}` }).click();
  await page.getByRole("menuitem", { name: "Nonaktifkan", exact: true }).click();
  const banDialog = page.getByRole("dialog");
  await banDialog.getByLabel("Alasan (opsional)").fill("Uji otomatis E2E");
  await banDialog.getByRole("button", { name: "Nonaktifkan", exact: true }).click();
  await expect(page.getByText("Pengguna dinonaktifkan.")).toBeVisible();

  // 4) Akun nonaktif tidak dapat masuk (konteks browser terpisah tanpa sesi admin).
  const bannedContext = await browser.newContext({ baseURL: BASE_URL });
  try {
    const bannedPage = await bannedContext.newPage();
    await login(bannedPage, email, "password123");
    await expect(
      bannedPage.getByText("Akun ini dinonaktifkan. Hubungi Administrator."),
    ).toBeVisible();
    await expect(bannedPage).toHaveURL(/\/login/);
  } finally {
    await bannedContext.close();
  }

  // 5) Aktifkan kembali dan pastikan pengguna bisa masuk dengan role Sales.
  row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: `Aksi untuk ${name}` }).click();
  await page.getByRole("menuitem", { name: "Aktifkan Kembali", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aktifkan", exact: true }).click();
  await expect(page.getByText("Pengguna diaktifkan kembali.")).toBeVisible();

  const activeContext = await browser.newContext({ baseURL: BASE_URL });
  try {
    const activePage = await activeContext.newPage();
    await login(activePage, email, "password123");
    await expect(activePage).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    await expectSidebarLink(sidebarOf(activePage), "Sales Order");
    await expect(activePage.getByRole("link", { name: "Pengguna", exact: true })).toHaveCount(0);
  } finally {
    await activeContext.close();
  }
});

test("admin tidak dapat menonaktifkan akunnya sendiri", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/users");
  await page.getByLabel("Cari pengguna").fill(ADMIN.email);
  await page.getByLabel("Cari pengguna").press("Enter");

  const row = page.getByRole("row").filter({ hasText: ADMIN.email });
  await expect(row).toBeVisible();
  await expect(row.getByText("Anda", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: /^Aksi untuk / }).click();
  await expect(page.getByRole("menuitem", { name: "Nonaktifkan", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
});

test("admin melihat audit log dan memfilternya per aksi", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/audit");
  await expect(page.getByRole("heading", { name: "Audit Log", exact: true })).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toBeVisible();

  await page.getByLabel("Filter aksi").click();
  await page.getByRole("option", { name: "Buat PO", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Buat PO", exact: true }).first()).toBeVisible();
  await expect(page.getByTitle("purchase-order.create").first()).toBeVisible();
});
