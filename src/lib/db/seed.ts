import { asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  billsOfMaterials,
  bomItems,
  buyers,
  departments,
  employees,
  inventoryTransactions,
  materials,
  productionLines,
  productionOrders,
  productVariants,
  products,
  purchaseOrders,
  roles,
  salesOrderItems,
  salesOrders,
  suppliers,
  unitsOfMeasure,
  user,
  userRoles,
  warehouseLocations,
  warehouses,
} from "@/lib/db/schema";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { ROLE_SEED, type RoleCode } from "@/lib/permissions";
import { getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { adjustStock, transferStock } from "@/modules/inventory/service";
import {
  createMaterialReceipt,
  createPurchaseOrder,
  getPurchaseOrderDetail,
  orderPurchaseOrder,
  postMaterialReceipt,
} from "@/modules/purchasing/service";
import {
  createProductionOrder,
  getProductionOrderDetail,
  issueMaterials,
  listProducibleSalesOrderItems,
  recordStageOutput,
} from "@/modules/production/service";
import { createQcInspection } from "@/modules/qc/service";

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? DEMO_PASSWORD;

/** Satu akun demo per role (sumber: src/lib/demo-accounts.ts). */
const SEED_USERS = DEMO_ACCOUNTS;

const SAMPLE_BUYERS: readonly {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}[] = [
  {
    name: "PT Maju Garmen Sejahtera",
    contactPerson: "Budi Santoso",
    phone: "021-5550101",
    email: "budi@majugarmen.co.id",
    address: "Jl. Industri Raya No. 12, Jakarta Pusat",
  },
  {
    name: "CV Karya Tekstil Nusantara",
    contactPerson: "Siti Rahayu",
    phone: "022-4440202",
    email: "siti@karyatekstil.co.id",
    address: "Jl. Cigondewah No. 88, Bandung",
  },
  {
    name: "Global Apparel Trading Pte Ltd",
    contactPerson: "James Lim",
    phone: "+65-6222-3333",
    email: "james.lim@globalapparel.sg",
    address: "18 Robinson Road, Singapore",
  },
];

async function seedRoles(): Promise<Map<RoleCode, string>> {
  for (const role of ROLE_SEED) {
    await db.insert(roles).values(role).onConflictDoNothing({ target: roles.code });
  }
  const rows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const map = new Map<RoleCode, string>();
  for (const row of rows) {
    map.set(row.code as RoleCode, row.id);
  }
  return map;
}

async function seedUsers(roleIds: Map<RoleCode, string>): Promise<void> {
  const ctx = await auth.$context;

  for (const seedUser of SEED_USERS) {
    const existing = await ctx.internalAdapter.findUserByEmail(seedUser.email);
    let userId: string;

    if (existing?.user) {
      userId = existing.user.id;
    } else {
      const created = await ctx.internalAdapter.createUser(
        {
          name: seedUser.name,
          email: seedUser.email,
          emailVerified: true,
          role: seedUser.roleCode === "ADMIN" ? "admin" : "user",
        },
        { method: "email-password" },
      );
      await ctx.internalAdapter.linkAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: await ctx.password.hash(DEFAULT_PASSWORD),
      });
      userId = created.id;
    }

    const roleId = roleIds.get(seedUser.roleCode);
    if (roleId) {
      await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
    }
  }
}

async function seedBuyers(): Promise<void> {
  const existing = await db.select({ id: buyers.id }).from(buyers).limit(1);
  if (existing.length > 0) return;

  for (const buyer of SAMPLE_BUYERS) {
    const code = await nextDocumentNumber(db, "BUY", { period: null });
    await db.insert(buyers).values({ ...buyer, code });
  }
}

const SAMPLE_DEPARTMENTS = [
  { name: "Cutting", description: "Pemotongan kain sesuai pola." },
  { name: "Sewing", description: "Penjahitan dan perakitan potongan." },
  { name: "Finishing", description: "Penyelesaian, setrika, dan packing." },
  { name: "Gudang", description: "Penyimpanan bahan dan produk jadi." },
] as const;

const SAMPLE_EMPLOYEES: readonly {
  name: string;
  departmentName: string;
  jobTitle: string;
  employmentStatus: "ACTIVE" | "INACTIVE";
  phone: string;
}[] = [
  {
    name: "Andi Wijaya",
    departmentName: "Cutting",
    jobTitle: "Kepala Cutting",
    employmentStatus: "ACTIVE",
    phone: "0812-1111-2201",
  },
  {
    name: "Dewi Lestari",
    departmentName: "Sewing",
    jobTitle: "Supervisor Sewing",
    employmentStatus: "ACTIVE",
    phone: "0812-1111-2202",
  },
  {
    name: "Rina Kartika",
    departmentName: "Sewing",
    jobTitle: "Operator Jahit",
    employmentStatus: "ACTIVE",
    phone: "0812-1111-2203",
  },
  {
    name: "Joko Susilo",
    departmentName: "Finishing",
    jobTitle: "Operator Finishing",
    employmentStatus: "ACTIVE",
    phone: "0812-1111-2204",
  },
  {
    name: "Slamet Riyadi",
    departmentName: "Gudang",
    jobTitle: "Staf Gudang",
    employmentStatus: "ACTIVE",
    phone: "0812-1111-2205",
  },
  {
    name: "Budi Hartono",
    departmentName: "Gudang",
    jobTitle: "Staf Gudang",
    employmentStatus: "INACTIVE",
    phone: "0812-1111-2206",
  },
];

const SAMPLE_LINES = [
  { name: "Lini A — Kaos", notes: "Jalur produksi kaos & polo, kapasitas 400 pcs/hari." },
  { name: "Lini B — Kemeja", notes: "Jalur produksi kemeja, kapasitas 200 pcs/hari." },
  { name: "Lini C — Jaket", notes: "Jalur produksi jaket/hoodie, kapasitas 150 pcs/hari." },
] as const;

async function seedOrganization(): Promise<void> {
  const departmentIds = new Map<string, string>();

  const existingDepartments = await db.select({ id: departments.id }).from(departments).limit(1);
  if (existingDepartments.length === 0) {
    for (const department of SAMPLE_DEPARTMENTS) {
      const code = await nextDocumentNumber(db, "DEP", { period: null });
      await db.insert(departments).values({ ...department, code });
    }
  }

  const departmentRows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments);
  for (const row of departmentRows) {
    departmentIds.set(row.name, row.id);
  }

  const existingEmployees = await db.select({ id: employees.id }).from(employees).limit(1);
  if (existingEmployees.length === 0) {
    for (const employee of SAMPLE_EMPLOYEES) {
      const departmentId = departmentIds.get(employee.departmentName);
      if (!departmentId) continue;
      const code = await nextDocumentNumber(db, "EMP", { period: null });
      await db.insert(employees).values({
        code,
        name: employee.name,
        departmentId,
        jobTitle: employee.jobTitle,
        employmentStatus: employee.employmentStatus,
        phone: employee.phone,
      });
    }
  }

  const existingLines = await db.select({ id: productionLines.id }).from(productionLines).limit(1);
  if (existingLines.length === 0) {
    for (const line of SAMPLE_LINES) {
      const code = await nextDocumentNumber(db, "LIN", { period: null });
      await db.insert(productionLines).values({ ...line, code });
    }
  }
}

const SAMPLE_SUPPLIERS = [
  {
    name: "PT Sumber Benang Jaya",
    contactPerson: "Hendra Gunawan",
    phone: "021-5566778",
    email: "sales@sumberbenang.co.id",
    address: "Jl. Tekstil Raya No. 45, Tangerang",
  },
  {
    name: "CV Katun Prima Textile",
    contactPerson: "Lina Marlina",
    phone: "022-6677889",
    email: "lina@katunprima.co.id",
    address: "Jl. Soekarno Hatta No. 210, Bandung",
  },
  {
    name: "PT Aksesori Garmen Indonesia",
    contactPerson: "Rudi Setiawan",
    phone: "031-8899221",
    email: "order@aksesorigarmen.co.id",
    address: "Jl. Rungkut Industri No. 7, Surabaya",
  },
] as const;

async function seedSuppliers(): Promise<void> {
  const existing = await db.select({ id: suppliers.id }).from(suppliers).limit(1);
  if (existing.length > 0) return;

  for (const supplier of SAMPLE_SUPPLIERS) {
    const code = await nextDocumentNumber(db, "SUP", { period: null });
    await db.insert(suppliers).values({ ...supplier, code });
  }
}

const SAMPLE_UOMS = [
  { code: "PCS", name: "Pieces" },
  { code: "MTR", name: "Meter" },
  { code: "KG", name: "Kilogram" },
  { code: "ROLL", name: "Roll" },
  { code: "LUSIN", name: "Lusin" },
] as const;

const SAMPLE_MATERIALS: readonly {
  name: string;
  unitCode: string;
  minimumStock: string;
  notes?: string;
}[] = [
  {
    name: "Kain Katun Combed 30s",
    unitCode: "KG",
    minimumStock: "200",
    notes: "Bahan utama kaos/polo.",
  },
  {
    name: "Kain Katun Combed 24s",
    unitCode: "KG",
    minimumStock: "150",
    notes: "Bahan utama kemeja.",
  },
  {
    name: "Kain Fleece Cotton",
    unitCode: "KG",
    minimumStock: "100",
    notes: "Bahan utama jaket/hoodie.",
  },
  { name: "Benang Jahit Polyester", unitCode: "ROLL", minimumStock: "40" },
  { name: "Kancing Plastik 18L", unitCode: "LUSIN", minimumStock: "20" },
  { name: "Resleting YKK 20 cm", unitCode: "PCS", minimumStock: "500" },
  { name: "Label Woven Custom", unitCode: "PCS", minimumStock: "300" },
  { name: "Packaging Plastik 30x40", unitCode: "PCS", minimumStock: "500" },
];

async function seedUnitsAndMaterials(): Promise<Map<string, string>> {
  const existingUoms = await db.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure).limit(1);
  if (existingUoms.length === 0) {
    for (const uom of SAMPLE_UOMS) {
      await db.insert(unitsOfMeasure).values(uom).onConflictDoNothing({ target: unitsOfMeasure.code });
    }
  }

  const uomRows = await db
    .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code })
    .from(unitsOfMeasure);
  const uomIds = new Map(uomRows.map((row) => [row.code, row.id]));

  const materialIds = new Map<string, string>();
  const existingMaterials = await db.select({ id: materials.id }).from(materials).limit(1);
  if (existingMaterials.length === 0) {
    for (const material of SAMPLE_MATERIALS) {
      const unitId = uomIds.get(material.unitCode);
      if (!unitId) continue;
      const code = await nextDocumentNumber(db, "MAT", { period: null });
      const [row] = await db
        .insert(materials)
        .values({
          code,
          name: material.name,
          unitId,
          minimumStock: material.minimumStock,
          notes: material.notes,
        })
        .returning({ id: materials.id });
      if (row) materialIds.set(material.name, row.id);
    }
  } else {
    const rows = await db
      .select({ id: materials.id, name: materials.name })
      .from(materials);
    for (const row of rows) materialIds.set(row.name, row.id);
  }

  return materialIds;
}

const SAMPLE_PRODUCTS: readonly {
  name: string;
  description: string;
  variants: readonly { size: string; color: string }[];
}[] = [
  {
    name: "Kaos Polo Basic",
    description: "Polo lengan pendek bahan combed 30s, kerah rajut.",
    variants: [
      { size: "M", color: "Hitam" },
      { size: "L", color: "Hitam" },
      { size: "M", color: "Navy" },
      { size: "L", color: "Navy" },
    ],
  },
  {
    name: "Kemeja Casual Lengan Panjang",
    description: "Kemeja kantor lengan panjang bahan combed 24s.",
    variants: [
      { size: "S", color: "Putih" },
      { size: "M", color: "Putih" },
      { size: "L", color: "Putih" },
      { size: "M", color: "Navy" },
    ],
  },
  {
    name: "Jaket Hoodie Fleece",
    description: "Hoodie fleece cotton dengan resleting depan.",
    variants: [
      { size: "M", color: "Hitam" },
      { size: "L", color: "Hitam" },
      { size: "XL", color: "Hitam" },
    ],
  },
];

/** Segmen SKU varian: huruf besar, spasi/simbol → tanda hubung. */
function toSkuSegment(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedProducts(): Promise<Map<string, string>> {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    const rows = await db
      .select({ id: productVariants.id, variantSku: productVariants.variantSku })
      .from(productVariants);
    return new Map(rows.map((row) => [row.variantSku, row.id]));
  }

  const variantIds = new Map<string, string>();

  for (const product of SAMPLE_PRODUCTS) {
    const sku = await nextDocumentNumber(db, "PRD", { period: null });
    const [row] = await db
      .insert(products)
      .values({ sku, name: product.name, description: product.description })
      .returning({ id: products.id });
    if (!row) continue;

    for (const variant of product.variants) {
      const variantSku = `${sku}-${toSkuSegment(variant.size)}-${toSkuSegment(variant.color)}`;
      const [variantRow] = await db
        .insert(productVariants)
        .values({
          productId: row.id,
          size: variant.size,
          color: variant.color,
          variantSku,
        })
        .returning({ id: productVariants.id });
      if (variantRow) variantIds.set(variantSku, variantRow.id);
    }
  }

  return variantIds;
}

const SAMPLE_WAREHOUSES: readonly {
  name: string;
  address: string;
  locations: readonly { code: string; name: string }[];
}[] = [
  {
    name: "Gudang Utama",
    address: "Jl. Industri Raya No. 12, Jakarta Pusat",
    locations: [
      { code: "A-01", name: "Rak Kain Roll" },
      { code: "A-02", name: "Rak Aksesori" },
      { code: "B-01", name: "Area Produk Jadi" },
    ],
  },
  {
    name: "Gudang Aksesori",
    address: "Jl. Industri Raya No. 14, Jakarta Pusat",
    locations: [
      { code: "C-01", name: "Rak Kancing & Label" },
      { code: "C-02", name: "Rak Benang" },
    ],
  },
];

async function seedWarehouses(): Promise<void> {
  const existing = await db.select({ id: warehouses.id }).from(warehouses).limit(1);
  if (existing.length > 0) return;

  for (const warehouse of SAMPLE_WAREHOUSES) {
    const code = await nextDocumentNumber(db, "WH", { period: null });
    const [row] = await db
      .insert(warehouses)
      .values({ code, name: warehouse.name, address: warehouse.address })
      .returning({ id: warehouses.id });
    if (!row) continue;
    for (const location of warehouse.locations) {
      await db
        .insert(warehouseLocations)
        .values({ warehouseId: row.id, code: location.code, name: location.name });
    }
  }
}

/**
 * BOM aktif (versi 1) untuk sebagian varian. Format item: [nama material,
 * kebutuhan per unit, cadangan].
 */
const SAMPLE_BOMS: readonly {
  variantSku: string;
  notes: string;
  items: readonly [string, string, string][];
}[] = [
  {
    variantSku: "PRD-0001-M-HITAM",
    notes: "Resep standar polo combed 30s.",
    items: [
      ["Kain Katun Combed 30s", "0.3500", "0.0200"],
      ["Benang Jahit Polyester", "0.0200", "0.0000"],
      ["Kancing Plastik 18L", "0.2500", "0.0100"],
      ["Label Woven Custom", "1.0000", "0.0000"],
      ["Packaging Plastik 30x40", "1.0000", "0.0000"],
    ],
  },
  {
    variantSku: "PRD-0002-M-PUTIH",
    notes: "Resep standar kemeja combed 24s.",
    items: [
      ["Kain Katun Combed 24s", "0.4000", "0.0300"],
      ["Benang Jahit Polyester", "0.0300", "0.0000"],
      ["Kancing Plastik 18L", "0.7500", "0.0200"],
      ["Label Woven Custom", "1.0000", "0.0000"],
      ["Packaging Plastik 30x40", "1.0000", "0.0000"],
    ],
  },
  {
    variantSku: "PRD-0003-M-HITAM",
    notes: "Resep standar hoodie fleece.",
    items: [
      ["Kain Fleece Cotton", "0.6000", "0.0400"],
      ["Benang Jahit Polyester", "0.0400", "0.0000"],
      ["Resleting YKK 20 cm", "1.0000", "0.0000"],
      ["Label Woven Custom", "1.0000", "0.0000"],
      ["Packaging Plastik 30x40", "1.0000", "0.0000"],
    ],
  },
];

async function seedBoms(
  variantIds: Map<string, string>,
  materialIds: Map<string, string>,
): Promise<void> {
  const existing = await db.select({ id: billsOfMaterials.id }).from(billsOfMaterials).limit(1);
  if (existing.length > 0) return;

  const today = getTodayDate();

  for (const bom of SAMPLE_BOMS) {
    const variantId = variantIds.get(bom.variantSku);
    if (!variantId) continue;

    const [row] = await db
      .insert(billsOfMaterials)
      .values({
        variantId,
        version: 1,
        isActive: true,
        effectiveFrom: today,
        notes: bom.notes,
      })
      .returning({ id: billsOfMaterials.id });
    if (!row) continue;

    for (const [materialName, quantityPerUnit, scrapAllowance] of bom.items) {
      const materialId = materialIds.get(materialName);
      if (!materialId) continue;
      await db.insert(bomItems).values({
        bomId: row.id,
        materialId,
        quantityPerUnit,
        scrapAllowance,
      });
    }
  }
}

/** Contoh SO lintas status; item dirujuk dari SKU varian. */
const SAMPLE_SALES_ORDERS: readonly {
  buyerIndex: number;
  orderOffsetDays: number;
  dueOffsetDays: number;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  cancelReason?: string;
  notes?: string;
  items: readonly { variantSku: string; quantity: number; unitPrice: string }[];
}[] = [
  {
    buyerIndex: 0,
    orderOffsetDays: -2,
    dueOffsetDays: 14,
    status: "DRAFT",
    notes: "Menunggu konfirmasi harga akhir dari buyer.",
    items: [
      { variantSku: "PRD-0001-M-HITAM", quantity: 120, unitPrice: "85000.00" },
      { variantSku: "PRD-0001-L-NAVY", quantity: 80, unitPrice: "88000.00" },
    ],
  },
  {
    buyerIndex: 1,
    orderOffsetDays: -10,
    dueOffsetDays: 5,
    status: "CONFIRMED",
    items: [
      { variantSku: "PRD-0002-M-PUTIH", quantity: 60, unitPrice: "145000.00" },
      { variantSku: "PRD-0002-L-PUTIH", quantity: 40, unitPrice: "145000.00" },
    ],
  },
  {
    buyerIndex: 2,
    orderOffsetDays: -12,
    dueOffsetDays: -1,
    status: "CONFIRMED",
    notes: "Prioritaskan — tenggat sudah lewat.",
    items: [{ variantSku: "PRD-0003-M-HITAM", quantity: 30, unitPrice: "210000.00" }],
  },
  {
    buyerIndex: 0,
    orderOffsetDays: -20,
    dueOffsetDays: -5,
    status: "CANCELLED",
    cancelReason: "Buyer mengganti spesifikasi bahan.",
    items: [{ variantSku: "PRD-0001-M-NAVY", quantity: 50, unitPrice: "86000.00" }],
  },
];

async function seedSalesOrders(variantIds: Map<string, string>): Promise<void> {
  const existing = await db.select({ id: salesOrders.id }).from(salesOrders).limit(1);
  if (existing.length > 0) return;

  const buyerRows = await db
    .select({ id: buyers.id })
    .from(buyers)
    .orderBy(asc(buyers.code))
    .limit(3);

  for (const order of SAMPLE_SALES_ORDERS) {
    const buyer = buyerRows[order.buyerIndex];
    if (!buyer) continue;

    const number = await nextDocumentNumber(db, "SO");
    const now = new Date();
    const [row] = await db
      .insert(salesOrders)
      .values({
        number,
        buyerId: buyer.id,
        orderDate: getDateOffset(order.orderOffsetDays),
        dueDate: getDateOffset(order.dueOffsetDays),
        status: order.status,
        notes: order.notes ?? null,
        cancelReason: order.cancelReason ?? null,
        confirmedAt: order.status === "CONFIRMED" ? now : null,
        cancelledAt: order.status === "CANCELLED" ? now : null,
      })
      .returning({ id: salesOrders.id });
    if (!row) continue;

    for (const item of order.items) {
      const variantId = variantIds.get(item.variantSku);
      if (!variantId) continue;
      await db.insert(salesOrderItems).values({
        salesOrderId: row.id,
        variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        dueDate: getDateOffset(order.dueOffsetDays),
      });
    }
  }
}

/**
 * Contoh purchase order lintas status + penerimaan (F3): draf, dipesan dengan
 * penerimaan draf, sebagian diterima (diposting), dan diterima penuh (diposting).
 */
async function seedPurchasing(
  materialIds: Map<string, string>,
  actorUserId: string,
): Promise<void> {
  const existing = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).limit(1);
  if (existing.length > 0) return;

  const supplierRows = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .orderBy(asc(suppliers.code))
    .limit(2);
  const supplierA = supplierRows[0];
  const supplierB = supplierRows[1] ?? supplierRows[0];
  if (!supplierA || !supplierB) return;

  const locationRows = await db
    .select({ id: warehouseLocations.id, code: warehouseLocations.code })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .orderBy(asc(warehouses.name), asc(warehouseLocations.code));
  const locationByCode = new Map(locationRows.map((row) => [row.code, row.id]));

  const fabricLocationId = locationByCode.get("A-01");
  const accessoryLocationId = locationByCode.get("A-02");
  if (!fabricLocationId || !accessoryLocationId) return;

  const material = (name: string): string | undefined => materialIds.get(name);

  // PO 1 — draf: belum dipesan, masih bisa diubah/dibatalkan.
  const benangId = material("Benang Jahit Polyester");
  const labelId = material("Label Woven Custom");
  if (benangId && labelId) {
    await createPurchaseOrder(
      {
        supplierId: supplierB.id,
        orderDate: getDateOffset(-1),
        expectedDate: getDateOffset(10),
        notes: "Menunggu konfirmasi harga akhir dari supplier.",
        items: [
          { materialId: benangId, orderedQuantity: 24, unitPrice: 45000, notes: "" },
          { materialId: labelId, orderedQuantity: 1000, unitPrice: 750, notes: "" },
        ],
      },
      actorUserId,
    );
  }

  // PO 2 — dipesan, barang sebagian tiba sebagai draf penerimaan (siap diposting di UI).
  const combed24Id = material("Kain Katun Combed 24s");
  if (combed24Id) {
    const order = await createPurchaseOrder(
      {
        supplierId: supplierA.id,
        orderDate: getDateOffset(-4),
        expectedDate: getDateOffset(2),
        notes: "Termin 30% DP, sisanya setelah barang diterima.",
        items: [{ materialId: combed24Id, orderedQuantity: 150, unitPrice: 92000, notes: "" }],
      },
      actorUserId,
    );
    await orderPurchaseOrder(order.id, actorUserId);

    const detail = await getPurchaseOrderDetail(order.id);
    const item = detail.items[0];
    if (item) {
      await createMaterialReceipt(
        {
          purchaseOrderId: order.id,
          receivedAt: getTodayDate(),
          locationId: fabricLocationId,
          notes: "Surat jalan GJ-2214 — sebagian barang tiba lebih awal.",
          items: [
            {
              purchaseOrderItemId: item.id,
              receivedQuantity: 90,
              acceptedQuantity: 80,
              notes: "10 kg warna tidak sesuai pesanan.",
            },
          ],
        },
        actorUserId,
      );
    }
  }

  // PO 3 — sebagian diterima: penerimaan sudah diposting sehingga stok bertambah.
  const combed30Id = material("Kain Katun Combed 30s");
  if (combed30Id) {
    const order = await createPurchaseOrder(
      {
        supplierId: supplierA.id,
        orderDate: getDateOffset(-8),
        expectedDate: getDateOffset(-2),
        notes: "Prioritas produksi kaos polo.",
        items: [{ materialId: combed30Id, orderedQuantity: 200, unitPrice: 88000, notes: "" }],
      },
      actorUserId,
    );
    await orderPurchaseOrder(order.id, actorUserId);

    const detail = await getPurchaseOrderDetail(order.id);
    const item = detail.items[0];
    if (item) {
      const receipt = await createMaterialReceipt(
        {
          purchaseOrderId: order.id,
          receivedAt: getDateOffset(-2),
          locationId: fabricLocationId,
          notes: "Kirim tahap 1 dari 2.",
          items: [
            {
              purchaseOrderItemId: item.id,
              receivedQuantity: 120,
              acceptedQuantity: 120,
              notes: "",
            },
          ],
        },
        actorUserId,
      );
      await postMaterialReceipt(receipt.id, actorUserId);
    }
  }

  // PO 4 — diterima penuh dan sudah diposting: siklus PO selesai.
  const benangFullId = material("Benang Jahit Polyester");
  const kancingId = material("Kancing Plastik 18L");
  if (benangFullId && kancingId) {
    const order = await createPurchaseOrder(
      {
        supplierId: supplierB.id,
        orderDate: getDateOffset(-12),
        expectedDate: getDateOffset(-6),
        notes: "Restock bulanan aksesori.",
        items: [
          { materialId: benangFullId, orderedQuantity: 40, unitPrice: 45000, notes: "" },
          { materialId: kancingId, orderedQuantity: 40, unitPrice: 9500, notes: "" },
        ],
      },
      actorUserId,
    );
    await orderPurchaseOrder(order.id, actorUserId);

    const detail = await getPurchaseOrderDetail(order.id);
    const items = detail.items
      .filter((item) => Number(item.remainingQuantity) > 0)
      .map((item) => ({
        purchaseOrderItemId: item.id,
        receivedQuantity: Number(item.remainingQuantity),
        acceptedQuantity: Number(item.remainingQuantity),
        notes: "",
      }));
    if (items.length > 0) {
      const receipt = await createMaterialReceipt(
        {
          purchaseOrderId: order.id,
          receivedAt: getDateOffset(-5),
          locationId: accessoryLocationId,
          notes: "Barang diterima lengkap.",
          items,
        },
        actorUserId,
      );
      await postMaterialReceipt(receipt.id, actorUserId);
    }
  }
}

/**
 * Contoh operasi stok manual (F3): transfer antar lokasi dan penyesuaian opname.
 * Dijalankan lewat service agar saldo dan audit konsisten dengan aplikasi.
 */
async function seedInventoryOperations(actorUserId: string): Promise<void> {
  const existing = await db
    .select({ id: inventoryTransactions.id })
    .from(inventoryTransactions)
    .where(inArray(inventoryTransactions.referenceType, ["manual-transfer", "manual-adjustment"]))
    .limit(1);
  if (existing.length > 0) return;

  const materialRows = await db.select({ id: materials.id, name: materials.name }).from(materials);
  const materialByName = new Map(materialRows.map((row) => [row.name, row.id]));

  const locationRows = await db
    .select({ id: warehouseLocations.id, code: warehouseLocations.code })
    .from(warehouseLocations);
  const locationByCode = new Map(locationRows.map((row) => [row.code, row.id]));

  const combed30Id = materialByName.get("Kain Katun Combed 30s");
  const fabricLocationId = locationByCode.get("A-01");
  const accessoryLocationId = locationByCode.get("A-02");
  if (combed30Id && fabricLocationId && accessoryLocationId) {
    await transferStock(
      {
        itemType: "MATERIAL",
        materialId: combed30Id,
        variantId: "",
        fromLocationId: fabricLocationId,
        toLocationId: accessoryLocationId,
        quantity: 30,
        notes: "Pemindahan kain untuk jadwal potong minggu ini.",
      },
      actorUserId,
    );
  }

  const kancingId = materialByName.get("Kancing Plastik 18L");
  const kancingLocationId = locationByCode.get("C-01");
  if (kancingId && kancingLocationId) {
    await adjustStock(
      {
        direction: "IN",
        itemType: "MATERIAL",
        materialId: kancingId,
        variantId: "",
        locationId: kancingLocationId,
        quantity: 5,
        reason: "Hasil opname mingguan — selisih lebih 5 lusin.",
        notes: "",
      },
      actorUserId,
    );
  }
}

/**
 * Contoh produksi & QC (F4). Lewat service agar aturan produksi ditegakkan:
 * stok bahan hoodie ditambah lewat PO + penerimaan diposting, lalu dibuat tiga
 * SPK — satu selesai penuh (termasuk alur rework), satu sedang berjalan,
 * dan satu kekurangan material dengan alasan tetap dijalankan.
 */
async function seedProduction(
  materialIds: Map<string, string>,
  actorUserId: string,
): Promise<void> {
  const existing = await db.select({ id: productionOrders.id }).from(productionOrders).limit(1);
  if (existing.length > 0) return;

  const [line] = await db
    .select()
    .from(productionLines)
    .where(eq(productionLines.isActive, true))
    .orderBy(asc(productionLines.name))
    .limit(1);
  if (!line) return;

  const locationRows = await db
    .select({ id: warehouseLocations.id, code: warehouseLocations.code })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .orderBy(asc(warehouses.name), asc(warehouseLocations.code));
  const locationByCode = new Map(locationRows.map((row) => [row.code, row.id]));
  const fabricLocationId = locationByCode.get("A-01");
  if (!fabricLocationId) return;

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .orderBy(asc(suppliers.code))
    .limit(1);

  const fleeceId = materialIds.get("Kain Fleece Cotton");
  const threadId = materialIds.get("Benang Jahit Polyester");
  const zipperId = materialIds.get("Resleting YKK 20 cm");
  const labelId = materialIds.get("Label Woven Custom");
  const packagingId = materialIds.get("Packaging Plastik 30x40");

  // Stok bahan hoodie (PO + penerimaan penuh) supaya SPK contoh lolos gate material.
  if (supplier && fleeceId && threadId && zipperId && labelId && packagingId) {
    const order = await createPurchaseOrder(
      {
        supplierId: supplier.id,
        orderDate: getDateOffset(-6),
        expectedDate: getDateOffset(-3),
        notes: "Restock bahan hoodie untuk SPK contoh.",
        items: [
          { materialId: fleeceId, orderedQuantity: 60, unitPrice: 78000, notes: "" },
          { materialId: threadId, orderedQuantity: 30, unitPrice: 45000, notes: "" },
          { materialId: zipperId, orderedQuantity: 120, unitPrice: 6500, notes: "" },
          { materialId: labelId, orderedQuantity: 200, unitPrice: 750, notes: "" },
          { materialId: packagingId, orderedQuantity: 200, unitPrice: 1200, notes: "" },
        ],
      },
      actorUserId,
    );
    await orderPurchaseOrder(order.id, actorUserId);

    const detail = await getPurchaseOrderDetail(order.id);
    const receipt = await createMaterialReceipt(
      {
        purchaseOrderId: order.id,
        receivedAt: getDateOffset(-3),
        locationId: fabricLocationId,
        notes: "Barang diterima lengkap.",
        items: detail.items.map((item) => ({
          purchaseOrderItemId: item.id,
          receivedQuantity: Number(item.remainingQuantity),
          acceptedQuantity: Number(item.remainingQuantity),
          notes: "",
        })),
      },
      actorUserId,
    );
    await postMaterialReceipt(receipt.id, actorUserId);
  }

  const producible = await listProducibleSalesOrderItems();
  const hoodieItem = producible.find((item) => item.variantSku === "PRD-0003-M-HITAM");
  const shirtItem = producible.find((item) => item.variantSku === "PRD-0002-M-PUTIH");

  if (hoodieItem) {
    // SPK 1 — 15 unit, alur penuh sampai packing dengan satu putaran rework.
    const orderA = await createProductionOrder(
      {
        salesOrderItemId: hoodieItem.salesOrderItemId,
        plannedQuantity: 15,
        productionLineId: line.id,
        plannedStartDate: getDateOffset(-4),
        plannedEndDate: getDateOffset(1),
        notes: "Prioritas buyer — kualitas jahitan diperketat.",
      },
      actorUserId,
    );

    const detailA = await getProductionOrderDetail(orderA.id);
    const stageIdByCode = new Map(detailA.stages.map((stage) => [stage.stageCode, stage.id]));

    // Pemakaian material sesuai BOM (stok berkurang lewat inventory engine).
    const issueItems = detailA.planning.rows.map((row) => ({
      materialId: row.materialId,
      quantity: Math.round((row.grossQuantity + row.allowanceQuantity) * 10_000) / 10_000,
      notes: "",
    }));
    if (issueItems.length > 0) {
      await issueMaterials(
        orderA.id,
        {
          locationId: fabricLocationId,
          issuedAt: getDateOffset(-4),
          notes: "Pemakaian material untuk 15 unit hoodie.",
          idempotencyKey: "seed-spk-hoodie-15",
          items: issueItems,
        },
        actorUserId,
      );
    }

    // Cutting: satu unit cacat → QC rework → dikerjakan ulang → inspeksi ulang lulus.
    const cuttingId = stageIdByCode.get("CUTTING");
    await recordStageOutput(
      orderA.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 15,
        passedQuantity: 14,
        rejectedQuantity: 1,
        isRework: false,
        notes: "Satu potongan kain bergaris.",
      },
      actorUserId,
    );
    if (cuttingId) {
      const reworkInspection = await createQcInspection(
        {
          productionStageId: cuttingId,
          inspectedQuantity: 14,
          passedQuantity: 13,
          rejectedQuantity: 1,
          result: "REWORK",
          notes: "Potongan miring pada satu unit — dikembalikan untuk rework.",
          defects: [
            {
              defectCode: "CUT-01",
              defectName: "Potongan miring",
              quantity: 1,
              disposition: "Rework",
            },
          ],
        },
        actorUserId,
      );
      await recordStageOutput(
        orderA.id,
        {
          stageCode: "CUTTING",
          processedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          isRework: true,
          notes: "Perbaikan potongan selesai.",
        },
        actorUserId,
      );
      await createQcInspection(
        {
          productionStageId: cuttingId,
          parentInspectionId: reworkInspection.id,
          inspectedQuantity: 1,
          passedQuantity: 1,
          rejectedQuantity: 0,
          result: "PASS",
          notes: "Hasil rework diterima.",
          defects: [],
        },
        actorUserId,
      );
    }

    // Jahit → finishing → packing seluruhnya lolos 15 unit; tiap tahap diperiksa QC.
    for (const stageCode of ["SEWING", "FINISHING", "PACKING"] as const) {
      const stageId = stageIdByCode.get(stageCode);
      if (!stageId) continue;
      await recordStageOutput(
        orderA.id,
        {
          stageCode,
          processedQuantity: 15,
          passedQuantity: 15,
          rejectedQuantity: 0,
          isRework: false,
          notes: "",
        },
        actorUserId,
      );
      await createQcInspection(
        {
          productionStageId: stageId,
          inspectedQuantity: 15,
          passedQuantity: 15,
          rejectedQuantity: 0,
          result: "PASS",
          notes: "Diperiksa sesuai standar kualitas.",
          defects: [],
        },
        actorUserId,
      );
    }

    // SPK 2 — sisa 15 unit, baru selesai cutting dengan rework menunggu dikerjakan.
    const orderB = await createProductionOrder(
      {
        salesOrderItemId: hoodieItem.salesOrderItemId,
        plannedQuantity: 15,
        productionLineId: line.id,
        plannedStartDate: getDateOffset(-1),
        plannedEndDate: getDateOffset(7),
        notes: "Sisa pesanan hoodie — dikerjakan pekan ini.",
      },
      actorUserId,
    );
    await recordStageOutput(
      orderB.id,
      {
        stageCode: "CUTTING",
        processedQuantity: 15,
        passedQuantity: 14,
        rejectedQuantity: 1,
        isRework: false,
        notes: "Hasil potong menunggu rework.",
      },
      actorUserId,
    );
    const detailB = await getProductionOrderDetail(orderB.id);
    const cuttingBId = detailB.stages.find((stage) => stage.stageCode === "CUTTING")?.id;
    if (cuttingBId) {
      await createQcInspection(
        {
          productionStageId: cuttingBId,
          inspectedQuantity: 14,
          passedQuantity: 13,
          rejectedQuantity: 1,
          result: "REWORK",
          notes: "Pola kerah bergeser pada satu unit.",
          defects: [
            {
              defectCode: "CUT-02",
              defectName: "Pola kerah bergeser",
              quantity: 1,
              disposition: "Rework",
            },
          ],
        },
        actorUserId,
      );
    }
  }

  if (shirtItem) {
    // SPK 3 — kekurangan kancing 1,2 lusin; tetap dijalankan dengan alasan (gate FR-08).
    await createProductionOrder(
      {
        salesOrderItemId: shirtItem.salesOrderItemId,
        plannedQuantity: shirtItem.remainingQuantity,
        productionLineId: line.id,
        plannedStartDate: getTodayDate(),
        plannedEndDate: getDateOffset(10),
        shortageReason: "Kancing plastik kurang 1,2 lusin — restock PO berjalan tiba minggu ini.",
        notes: "Bahan utama sudah tersedia; menunggu kancing.",
      },
      actorUserId,
    );
  }
}

/**
 * Seed idempotent untuk development: role, akun demo, buyer, master data
 * organisasi & produk, gudang, BOM contoh, sales order, purchase order,
 * penerimaan, operasi stok contoh (F1–F3), serta produksi & QC contoh (F4).
 */
export async function runSeed(): Promise<void> {
  console.log("Seed: roles...");
  const roleIds = await seedRoles();

  console.log("Seed: users...");
  await seedUsers(roleIds);

  console.log("Seed: buyers contoh...");
  await seedBuyers();

  console.log("Seed: organisasi (departemen, karyawan, lini)...");
  await seedOrganization();

  console.log("Seed: supplier...");
  await seedSuppliers();

  console.log("Seed: satuan & material...");
  const materialIds = await seedUnitsAndMaterials();

  console.log("Seed: produk & varian...");
  const variantIds = await seedProducts();

  console.log("Seed: gudang & lokasi...");
  await seedWarehouses();

  console.log("Seed: BOM contoh...");
  await seedBoms(variantIds, materialIds);

  console.log("Seed: sales order contoh...");
  await seedSalesOrders(variantIds);

  const adminEmail = SEED_USERS.find((u) => u.roleCode === "ADMIN")!.email;
  const [adminRow] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1);

  if (adminRow) {
    console.log("Seed: purchase order & penerimaan contoh...");
    await seedPurchasing(materialIds, adminRow.id);

    console.log("Seed: operasi stok contoh (transfer & penyesuaian)...");
    await seedInventoryOperations(adminRow.id);

    console.log("Seed: produksi & QC contoh...");
    await seedProduction(materialIds, adminRow.id);
  }

  console.log(`Seed selesai. Akun admin: ${adminEmail} (password: ${DEFAULT_PASSWORD}).`);
}
