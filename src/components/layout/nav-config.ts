import {
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
  Route,
  Ruler,
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
        roles: ["ADMIN", "MANAGER", "PURCHASING"],
        phase: "F3",
      },
      {
        title: "Inventori",
        href: "/inventory",
        icon: Boxes,
        roles: ["ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE"],
        phase: "F3",
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
        roles: ["ADMIN", "MANAGER", "PRODUCTION_SUPERVISOR"],
        phase: "F4",
      },
      {
        title: "Quality Control",
        href: "/qc",
        icon: ClipboardCheck,
        roles: ["ADMIN", "MANAGER", "QC_STAFF"],
        phase: "F4",
      },
    ],
  },
  {
    label: "Pengiriman & Laporan",
    items: [
      {
        title: "Pengiriman",
        href: "/shipping",
        icon: Truck,
        roles: ["ADMIN", "MANAGER", "SHIPPING_STAFF"],
        phase: "F5",
      },
      {
        title: "Laporan",
        href: "/reports",
        icon: BarChart3,
        roles: ["ADMIN", "MANAGER"],
        phase: "F5",
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [{ title: "Pengguna", href: "/settings/users", icon: Users, roles: ["ADMIN"] }],
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
  "/inventory": "Inventori",
  "/production": "Produksi",
  "/qc": "Quality Control",
  "/shipping": "Pengiriman",
  "/reports": "Laporan",
  "/settings": "Pengaturan",
  "/settings/users": "Pengguna",
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

export type Breadcrumb = { href: string; label: string };

/** Pecah pathname menjadi breadcrumb, mis. /settings/users → Pengaturan / Pengguna. */
export function breadcrumbsForPath(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  let current = "";
  for (const segment of pathname.split("/").filter(Boolean)) {
    current += `/${segment}`;
    crumbs.push({ href: current, label: labelForPath(current) });
  }
  return crumbs;
}
