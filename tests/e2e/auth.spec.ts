import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@garment.local", password: "password123" };
const QC = { email: "qc@garment.local", password: "password123" };

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("autentikasi", () => {
  test("pengunjung tanpa sesi diarahkan ke halaman masuk", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  });

  test("password salah menampilkan pesan galat Bahasa Indonesia", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("password-salah-sekali");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email atau password salah.")).toBeVisible();
  });

  test("admin dapat masuk dan melihat seluruh menu", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByText(/Selamat datang/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Buyer", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pengguna", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Laporan", exact: true })).toBeVisible();
  });

  test("keluar mengakhiri sesi dan mengembalikan ke halaman masuk", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /Administrator/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("otorisasi berbasis role", () => {
  test("staff QC tidak melihat menu admin dan ditolak di halaman pengguna", async ({ page }) => {
    await login(page, QC);

    await expect(page.getByRole("link", { name: "Quality Control", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pengguna", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Buyer", exact: true })).toHaveCount(0);

    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/akses-ditolak/);
    await expect(page.getByText("Akses ditolak", { exact: true })).toBeVisible();
  });
});
