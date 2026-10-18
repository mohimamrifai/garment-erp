import type { RoleCode } from "./permissions";

/**
 * Akun demo (satu per role) yang dibuat oleh seed. Dipakai bersama oleh:
 * - `src/lib/db/seed.ts` — pembuatan akun,
 * - halaman login mode demo (`NEXT_PUBLIC_DEMO_MODE=1`) — tombol masuk cepat.
 *
 * Jaga tetap sinkron dengan daftar akun di README.
 */
export type DemoAccount = {
  email: string;
  name: string;
  roleCode: RoleCode;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: "admin@garment.local", name: "Administrator", roleCode: "ADMIN" },
  { email: "manager@garment.local", name: "Manager", roleCode: "MANAGER" },
  { email: "sales@garment.local", name: "Sales", roleCode: "SALES" },
  { email: "purchasing@garment.local", name: "Purchasing", roleCode: "PURCHASING" },
  { email: "warehouse@garment.local", name: "Gudang", roleCode: "WAREHOUSE" },
  {
    email: "produksi@garment.local",
    name: "Supervisor Produksi",
    roleCode: "PRODUCTION_SUPERVISOR",
  },
  { email: "qc@garment.local", name: "Staff QC", roleCode: "QC_STAFF" },
  { email: "shipping@garment.local", name: "Staff Pengiriman", roleCode: "SHIPPING_STAFF" },
];

/**
 * Password akun demo. Seed dapat dioverride lewat `SEED_DEFAULT_PASSWORD`;
 * bila di-override, samakan nilai dengan `NEXT_PUBLIC_DEMO_MODE`-nya.
 */
export const DEMO_PASSWORD = "password123";
