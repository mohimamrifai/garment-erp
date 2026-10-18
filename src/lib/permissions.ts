/**
 * RBAC aplikasi (PRD §6).
 *
 * Sumber kebenaran role ada di tabel `roles` + `user_roles` (satu user bisa
 * punya banyak role). File ini mendefinisikan kode role, data seed, dan
 * matriks izin terketik yang dipakai `requirePagePermission()` / guard API.
 */

export const ROLE_CODES = [
  "ADMIN",
  "MANAGER",
  "SALES",
  "PURCHASING",
  "WAREHOUSE",
  "PRODUCTION_SUPERVISOR",
  "QC_STAFF",
  "SHIPPING_STAFF",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

export type RoleSeed = {
  code: RoleCode;
  name: string;
  description: string;
};

/** Data seed untuk tabel `roles` (8 role PRD). */
export const ROLE_SEED: readonly RoleSeed[] = [
  {
    code: "ADMIN",
    name: "Administrator",
    description: "Akses penuh, termasuk manajemen pengguna dan audit.",
  },
  {
    code: "MANAGER",
    name: "Manager",
    description: "Pemantauan lintas modul dan operasi tingkat lanjut.",
  },
  {
    code: "SALES",
    name: "Sales",
    description: "Buyer dan sales order.",
  },
  {
    code: "PURCHASING",
    name: "Purchasing",
    description: "Supplier, purchase order, dan penerimaan material.",
  },
  {
    code: "WAREHOUSE",
    name: "Gudang",
    description: "Stok material & barang jadi, transfer, dan penyesuaian.",
  },
  {
    code: "PRODUCTION_SUPERVISOR",
    name: "Supervisor Produksi",
    description: "SPK, tahapan produksi, dan pemakaian material.",
  },
  {
    code: "QC_STAFF",
    name: "Staff QC",
    description: "Inspeksi kualitas dan hasil QC.",
  },
  {
    code: "SHIPPING_STAFF",
    name: "Staff Pengiriman",
    description: "Pengiriman dan dokumen jalan.",
  },
] as const;

/**
 * Daftar izin (permission) per fase. Tambahkan entri baru saat modul baru
 * dibuat — jangan memakai string bebas di luar daftar ini.
 */
export type Permission =
  | "user.view"
  | "user.create"
  | "user.update"
  | "user.assign_roles"
  | "user.set_password"
  | "user.ban"
  | "audit.view"
  | "buyer.view"
  | "buyer.create"
  | "buyer.update"
  | "buyer.deactivate";

/** Matriks izin: permission → role yang boleh. */
export const PERMISSION_MATRIX: Record<Permission, readonly RoleCode[]> = {
  "user.view": ["ADMIN"],
  "user.create": ["ADMIN"],
  "user.update": ["ADMIN"],
  "user.assign_roles": ["ADMIN"],
  "user.set_password": ["ADMIN"],
  "user.ban": ["ADMIN"],
  "audit.view": ["ADMIN"],
  "buyer.view": ["ADMIN", "MANAGER", "SALES"],
  "buyer.create": ["ADMIN", "MANAGER", "SALES"],
  "buyer.update": ["ADMIN", "MANAGER", "SALES"],
  "buyer.deactivate": ["ADMIN", "MANAGER", "SALES"],
};

export function can(roles: readonly RoleCode[], permission: Permission): boolean {
  const allowed = PERMISSION_MATRIX[permission];
  return allowed.some((role) => roles.includes(role));
}
