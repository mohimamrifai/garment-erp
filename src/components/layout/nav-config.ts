import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTree,
  Package,
  PackageCheck,
  PackageSearch,
  Route,
  Ruler,
  ScrollText,
  Shirt,
  ShoppingCart,
  Truck,
  Users,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { ROLE_CODES, type RoleCode } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Role yang boleh melihat menu ini. */
  roles: readonly RoleCode[];
  /** Label fase untuk modul yang belum diimplementasikan (placeholder). */
  phase?: string;
};

export type NavSection = {
  label: string;
  items: readonly NavItem[];
};

const ALL_ROLES = ROLE_CODES;

/**
 * Konfigurasi menu sidebar. Visibilitas per role di sini bersifat navigasi;
 * penegakan izin tetap dilakukan di halaman/route handler masing-masing.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: "Utama",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL_ROLES }],
  },
  {
    label: "Penjualan",
    items: [
      { title: "Buyer", href: "/buyers", icon: Handshake, roles: ["ADMIN", "MANAGER", "SALES"] },
      {
        title: "Sales Order",
        href: "/sales",
        icon: ShoppingCart,
        roles: ["ADMIN", "MANAGER", "SALES"],
      },
    ],
  },
  {
    label: "Organisasi",
    items: [
      {
        title: "Departemen",
        href: "/master/departments",
        icon: Building2,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
      },
      {
        title: "Karyawan",
        href: "/master/employees",
        icon: UsersRound,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
      },
      {
        title: "Lini Produksi",
        href: "/master/lines",
        icon: Route,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
      },
    ],
  },
  {
    label: "Master Data",
    items: [
      {
        title: "Produk",
        href: "/master/products",
        icon: Shirt,
        roles: ["ADMIN", "MANAGER", "SALES", "PRODUCTION_SUPERVISOR"],
      },
      {
        title: "BOM",
        href: "/master/bom",
        icon: ListTree,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
      },
      {
        title: "Material",
        href: "/master/materials",
        icon: Package,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
      },
      {
        title: "Satuan",
        href: "/master/uoms",
        icon: Ruler,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
      },
      {
        title: "Supplier",
        href: "/master/suppliers",
        icon: Factory,
        roles: ["ADMIN", "MANAGER", "PURCHASING"],
      },
      {
        title: "Gudang",
        href: "/master/warehouses",
        icon: Warehouse,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
      },
    ],
  },
  {
    label: "Pembelian & Gudang",
    items: [
      {
        title: "Pembelian",
        href: "/purchasing",
        icon: FileText,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
      },
      {
        title: "Penerimaan",
        href: "/purchasing/receipts",
        icon: PackageCheck,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
      },
      {
        title: "Inventori",
        href: "/inventory",
        icon: Boxes,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "PRODUCTION_SUPERVISOR"],
      },
      {
        title: "Mutasi Stok",
        href: "/inventory/movements",
        icon: ArrowLeftRight,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "PRODUCTION_SUPERVISOR"],
      },
    ],
  },
  {
    label: "Produksi",
    items: [
      {
        title: "Produksi",
        href: "/production",
        icon: Factory,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR", "QC_STAFF"],
      },
      {
        title: "Quality Control",
        href: "/qc",
        icon: ClipboardCheck,
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR", "QC_STAFF"],
      },
    ],
  },
  {
    label: "Pengiriman & Laporan",
    items: [
      {
        title: "Barang Jadi",
        href: "/finished-goods",
        icon: PackageSearch,
        roles: ["ADMIN", "MANAGER", "SALES", "WAREHOUSE", "SHIPPING_STAFF"],
      },
      {
        title: "Pengiriman",
        href: "/shipping",
        icon: Truck,
        roles: ["ADMIN", "MANAGER", "SALES", "WAREHOUSE", "SHIPPING_STAFF"],
      },
      {
        title: "Laporan",
        href: "/reports",
        icon: BarChart3,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { title: "Pengguna", href: "/settings/users", icon: Users, roles: ["ADMIN"] },
      { title: "Audit Log", href: "/settings/audit", icon: ScrollText, roles: ["ADMIN"] },
    ],
  },
];

/** Filter menu sesuai role user (section kosong dibuang). */
export function visibleSections(roles: readonly RoleCode[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.some((role) => roles.includes(role))),
  })).filter((section) => section.items.length > 0);
}

const PATH_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/buyers": "Buyer",
  "/sales": "Sales Order",
  "/master": "Master Data",
  "/master/departments": "Departemen",
  "/master/employees": "Karyawan",
  "/master/lines": "Lini Produksi",
  "/master/products": "Produk",
  "/master/bom": "BOM",
  "/master/materials": "Material",
  "/master/uoms": "Satuan",
  "/master/suppliers": "Supplier",
  "/master/warehouses": "Gudang",
  "/purchasing": "Pembelian",
  "/purchasing/receipts": "Penerimaan Material",
  "/inventory": "Inventori",
  "/inventory/movements": "Mutasi Stok",
  "/production": "Produksi",
  "/qc": "Quality Control",
  "/shipping": "Pengiriman",
  "/reports": "Laporan",
  "/settings": "Pengaturan",
  "/settings/users": "Pengguna",
  "/settings/audit": "Audit Log",
  "/akses-ditolak": "Akses Ditolak",
};

const SEGMENT_LABELS: Record<string, string> = {
  new: "Baru",
  edit: "Ubah",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function labelForPath(path: string): string {
  const exact = PATH_LABELS[path];
  if (exact) return exact;
  const segment = path.split("/").filter(Boolean).pop() ?? "";
  if (!segment) return "";
  if (UUID_PATTERN.test(segment)) return "Detail";
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment[0]!.toUpperCase() + segment.slice(1);
}

export type Breadcrumb = { href?: string; label: string };

/** Path yang hanya berfungsi sebagai label grup (tidak punya halaman sendiri). */
const NON_PAGE_PATHS = new Set(["/master", "/settings"]);

/** Pecah pathname menjadi breadcrumb, mis. /settings/users → Pengaturan / Pengguna. */
export function breadcrumbsForPath(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  let current = "";
  for (const segment of pathname.split("/").filter(Boolean)) {
    current += `/${segment}`;
    crumbs.push({
      href: NON_PAGE_PATHS.has(current) ? undefined : current,
      label: labelForPath(current),
    });
  }
  return crumbs;
}
