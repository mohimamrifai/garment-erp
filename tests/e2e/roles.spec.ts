import { expect, test, type Page } from "@playwright/test";
import { expectSidebarLink, sidebarOf } from "./helpers/sidebar";

const PASSWORD = "password123";

type RoleCase = {
  role: string;
  email: string;
  /** Menu sidebar yang harus terlihat untuk role ini. */
  visible: string[];
  /** Menu sidebar yang harus disembunyikan untuk role ini. */
  hidden: string[];
  /** Halaman yang boleh dibuka role ini. */
  home: { path: string; heading: string };
  /** Halaman yang harus dialihkan ke /akses-ditolak (kosong = semua boleh). */
  denied: string;
};

/**
 * F6.1 — login setiap role, visibilitas menu, akses halaman yang diizinkan,
 * dan penolakan halaman yang tidak diizinkan. Sumber kebenaran:
 * `src/lib/permissions.ts` + `src/components/layout/nav-config.ts`.
 */
const CASES: readonly RoleCase[] = [
  {
    role: "Administrator",
    email: "admin@garment.local",
    visible: [
      "Buyer",
      "Sales Order",
      "Pembelian",
      "Produksi",
      "Quality Control",
      "Barang Jadi",
      "Pengiriman",
      "Laporan",
      "Pengguna",
      "Audit Log",
    ],
    hidden: [],
    home: { path: "/settings/users", heading: "Pengguna" },
    denied: "",
  },
  {
    role: "Manager",
    email: "manager@garment.local",
    visible: ["Buyer", "Sales Order", "Pembelian", "Produksi", "Barang Jadi", "Laporan"],
    hidden: ["Pengguna", "Audit Log"],
    home: { path: "/buyers", heading: "Buyer" },
    denied: "/settings/users",
  },
  {
    role: "Sales",
    email: "sales@garment.local",
    visible: ["Buyer", "Sales Order", "Barang Jadi", "Pengiriman", "Laporan"],
    hidden: ["Pembelian", "Produksi", "Quality Control", "Pengguna", "Audit Log"],
    home: { path: "/sales", heading: "Sales Order" },
    denied: "/purchasing/new",
  },
  {
    role: "Purchasing",
    email: "purchasing@garment.local",
    visible: [
      "Material",
      "Satuan",
      "Supplier",
      "Gudang",
      "Pembelian",
      "Penerimaan",
      "Inventori",
      "Mutasi Stok",
      "Laporan",
    ],
    hidden: [
      "Buyer",
      "Produksi",
      "Quality Control",
      "Barang Jadi",
      "Pengiriman",
      "Pengguna",
      "Audit Log",
    ],
    home: { path: "/purchasing", heading: "Pembelian" },
    denied: "/qc/new",
  },
  {
    role: "Gudang",
    email: "warehouse@garment.local",
    visible: [
      "Material",
      "Gudang",
      "Pembelian",
      "Penerimaan",
      "Inventori",
      "Mutasi Stok",
      "Barang Jadi",
      "Pengiriman",
      "Laporan",
    ],
    hidden: ["Buyer", "Sales Order", "Produksi", "Quality Control", "Pengguna", "Audit Log"],
    home: { path: "/inventory", heading: "Inventori" },
    denied: "/purchasing/new",
  },
  {
    role: "Supervisor Produksi",
    email: "produksi@garment.local",
    visible: [
      "Departemen",
      "Karyawan",
      "Lini Produksi",
      "Produk",
      "BOM",
      "Inventori",
      "Produksi",
      "Quality Control",
      "Laporan",
    ],
    hidden: ["Buyer", "Pembelian", "Barang Jadi", "Pengiriman", "Pengguna", "Audit Log"],
    home: { path: "/production", heading: "Produksi" },
    denied: "/settings/users",
  },
  {
    role: "Staff QC",
    email: "qc@garment.local",
    visible: ["Produksi", "Quality Control", "Laporan"],
    hidden: [
      "Buyer",
      "Sales Order",
      "Pembelian",
      "Barang Jadi",
      "Pengiriman",
      "Pengguna",
      "Audit Log",
    ],
    home: { path: "/qc", heading: "Quality Control" },
    denied: "/production/new",
  },
  {
    role: "Staff Pengiriman",
    email: "shipping@garment.local",
    visible: ["Barang Jadi", "Pengiriman", "Laporan"],
    hidden: ["Buyer", "Pembelian", "Produksi", "Quality Control", "Pengguna", "Audit Log"],
    home: { path: "/shipping", heading: "Pengiriman" },
    denied: "/production/new",
  },
];

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  // Permintaan autentikasi pertama setelah server start bisa lambat (cold start).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}

test.describe("otorisasi per role", () => {
  for (const roleCase of CASES) {
    test(`${roleCase.role}: menu, akses halaman, dan penolakan`, async ({ page }) => {
      await login(page, roleCase.email);
      await expect(page.getByText(/Selamat datang/)).toBeVisible();
      const sidebar = sidebarOf(page);
      await expect(sidebar.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
      await expectSidebarLink(sidebar, "Asisten AI");

      for (const menu of roleCase.visible) {
        await expectSidebarLink(sidebar, menu);
      }
      for (const menu of roleCase.hidden) {
        await expect(
          sidebar.getByRole("link", { name: menu, exact: true }),
          `menu "${menu}" harus tersembunyi untuk ${roleCase.role}`,
        ).toHaveCount(0);
      }

      // Halaman yang diizinkan harus terbuka, bukan dialihkan.
      await page.goto(roleCase.home.path);
      await expect(page).not.toHaveURL(/\/akses-ditolak/);
      await expect(
        page.getByRole("heading", { name: roleCase.home.heading, exact: true }),
      ).toBeVisible();

      // Halaman yang tidak diizinkan harus dialihkan ke /akses-ditolak.
      if (roleCase.denied) {
        await page.goto(roleCase.denied);
        await expect(page).toHaveURL(/\/akses-ditolak/);
        await expect(page.getByText("Akses ditolak", { exact: true })).toBeVisible();
      }
    });
  }
});
