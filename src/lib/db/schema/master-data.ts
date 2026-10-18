import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Master data (PRD §6.2): organisasi, supplier, satuan & material, produk &
 * varian, serta gudang & lokasi. Semua entitas memakai pola yang sama:
 * kode unik, status aktif/nonaktif (nonaktifkan — bukan hapus — saat sudah
 * dipakai transaksi), dan timestamps.
 */

/** Departemen (mis. Cutting, Sewing, Finishing, Gudang). */
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. DEP-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("departments_name_idx").on(t.name)],
);

/** Karyawan dasar (PRD §6.2). */
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. EMP-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id),
    jobTitle: text("job_title").notNull(),
    /** ACTIVE | INACTIVE (nonaktif = berhenti/tidak lagi bertugas). */
    employmentStatus: text("employment_status")
      .notNull()
      .default("ACTIVE")
      .$type<"ACTIVE" | "INACTIVE">(),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("employees_name_idx").on(t.name),
    index("employees_department_idx").on(t.departmentId),
    check("employees_status_chk", sql`${t.employmentStatus} in ('ACTIVE', 'INACTIVE')`),
  ],
);

/** Lini produksi (dipakai SPK di Fase 4). */
export const productionLines = pgTable(
  "production_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. LIN-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("production_lines_name_idx").on(t.name)],
);

/** Supplier (PRD FR-03) — struktur mengikuti buyer. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. SUP-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

/** Satuan pengukuran material (pcs, meter, kg, ...). Kode diisi manual. */
export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode singkat manual, mis. PCS / MTR / KG — dinormalkan ke huruf besar. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("units_of_measure_name_idx").on(t.name)],
);

/** Material (bahan baku & aksesori) dengan stok minimum (PRD FR-03). */
export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. MAT-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id),
    minimumStock: numeric("minimum_stock", { precision: 14, scale: 3 }).notNull().default("0"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("materials_name_idx").on(t.name),
    index("materials_unit_idx").on(t.unitId),
    check("materials_minimum_stock_chk", sql`${t.minimumStock} >= 0`),
  ],
);

/** Produk (model pakaian) — SKU unik (PRD §6.2). */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SKU otomatis, mis. PRD-0001 (dapat diubah ke kode internal pabrik). */
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("products_name_idx").on(t.name)],
);

/** Varian produk (ukuran × warna) — SKU varian unik (PRD §6.2). */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    size: text("size").notNull(),
    color: text("color").notNull(),
    /** SKU otomatis: `{sku produk}-{SIZE}-{COLOR}`, mis. PRD-0001-M-BLACK. */
    variantSku: text("variant_sku").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    index("product_variants_name_idx").on(t.size, t.color),
    unique("product_variants_product_size_color_uq").on(t.productId, t.size, t.color),
  ],
);

/** Gudang penyimpanan. */
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kode otomatis, mis. WH-0001. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("warehouses_name_idx").on(t.name)],
);

/** Lokasi/rak di dalam gudang — kode unik per gudang (PRD §6.2). */
export const warehouseLocations = pgTable(
  "warehouse_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    /** Kode manual, mis. A-01 (dinormalkan ke huruf besar). */
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("warehouse_locations_warehouse_idx").on(t.warehouseId),
    unique("warehouse_locations_warehouse_code_uq").on(t.warehouseId, t.code),
  ],
);
