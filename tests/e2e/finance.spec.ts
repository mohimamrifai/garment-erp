import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@garment.local", password: "password123" };
const HR = { email: "hr@garment.local", password: "password123" };
const FINANCE = { email: "finance@garment.local", password: "password123" };

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("HRIS, payroll, dan akuntansi", () => {
  test("admin membuka halaman absensi dan cuti", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/hr/attendance");
    await expect(page.getByRole("heading", { name: "Absensi", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Catat Absensi", exact: true })).toBeVisible();

    await page.goto("/hr/leave");
    await expect(page.getByRole("heading", { name: "Cuti", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajukan Cuti", exact: true })).toBeVisible();
  });

  test("admin membuka payroll dan detail slip gaji", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();

    const payrollLink = page.locator('table a[href^="/payroll/"]').first();
    await expect(payrollLink).toBeVisible();
    await payrollLink.click();
    await expect(page).toHaveURL(/\/payroll\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: /Payroll \d{4}-\d{2}/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Slip Gaji", exact: true })).toBeVisible();
  });

  test("admin membuka jurnal, kas & bank, tutup buku, dan laporan keuangan", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/accounting");
    await expect(page.getByRole("heading", { name: "Akuntansi", exact: true })).toBeVisible();
    await expect(page.getByText("Kas & Bank", { exact: true }).first()).toBeVisible();

    await page.goto("/accounting/journals");
    await expect(page.getByRole("heading", { name: "Jurnal", exact: true })).toBeVisible();
    const journalLink = page.locator('table a[href^="/accounting/journals/"]').first();
    await expect(journalLink).toBeVisible();
    await journalLink.click();
    await expect(page.getByRole("heading", { name: /Jurnal JE-/ })).toBeVisible();
    await expect(page.getByText("Informasi Jurnal", { exact: true })).toBeVisible();

    await page.goto("/accounting/payments");
    await expect(page.getByRole("heading", { name: "Kas & Bank", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Catat Kas/Bank", exact: true })).toBeVisible();

    await page.goto("/accounting/periods");
    await expect(page.getByRole("heading", { name: "Tutup Buku", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tutup Periode", exact: true })).toBeVisible();

    await page.goto("/accounting/reports");
    await expect(
      page.getByRole("heading", { name: "Laporan Keuangan", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Neraca Saldo/ }).click();
    await expect(page).toHaveURL(/\/reports\?report=trial-balance/);
    await expect(page.getByText("Neraca Saldo", { exact: true }).first()).toBeVisible();
  });

  test("staff HR tidak dapat membuka akuntansi", async ({ page }) => {
    await login(page, HR);
    await page.goto("/hr/attendance");
    await expect(page.getByRole("heading", { name: "Absensi", exact: true })).toBeVisible();
    await page.goto("/accounting");
    await expect(page).toHaveURL(/\/akses-ditolak/);
  });

  test("staff keuangan dapat membuka akuntansi tetapi tidak pengguna", async ({ page }) => {
    await login(page, FINANCE);
    await page.goto("/accounting");
    await expect(page.getByRole("heading", { name: "Akuntansi", exact: true })).toBeVisible();
    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/akses-ditolak/);
  });
});
