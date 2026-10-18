import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  inventoryBalances,
  inventoryTransactions,
  materials,
  productVariants,
  products,
  unitsOfMeasure,
  warehouseLocations,
  warehouses,
  type InventoryTransaction,
} from "@/lib/db/schema";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "./engine";
import type {
  AdjustStockInput,
  ListInventoryBalancesQuery,
  ListInventoryTransactionsQuery,
  TransferStockInput,
} from "./schemas";

/**
 * Query baca & operasi stok (F3 task 3.5–3.8). Semua perubahan stok tetap
 * melewati `postMovement()` di engine; service ini hanya membungkus validasi
 * tambahan + audit.
 */

export type InventoryItemTypeName = "MATERIAL" | "FINISHED_GOOD";

export type InventoryBalanceListRow = {
  id: string;
  itemType: InventoryItemTypeName;
  materialId: string | null;
  materialCode: string | null;
  materialName: string | null;
  variantId: string | null;
  variantSku: string | null;
  size: string | null;
  color: string | null;
  productName: string | null;
  unitCode: string | null;
  minimumStock: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  warehouseId: string;
  warehouseName: string;
  updatedAt: Date;
};

export async function listInventoryBalances(
  params: ListInventoryBalancesQuery,
): Promise<{ items: InventoryBalanceListRow[]; total: number; lowStockCount: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(materials.code, pattern),
        ilike(materials.name, pattern),
        ilike(productVariants.variantSku, pattern),
        ilike(products.name, pattern),
      ),
    );
  }
  if (params.warehouse) conditions.push(eq(warehouses.id, params.warehouse));
  if (params.location) conditions.push(eq(inventoryBalances.locationId, params.location));
  if (params.itemType !== "all") conditions.push(eq(inventoryBalances.itemType, params.itemType));
  if (params.low === "1") {
    conditions.push(
      and(
        eq(inventoryBalances.itemType, "MATERIAL"),
        sql`${inventoryBalances.quantityOnHand} < ${materials.minimumStock}`,
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select({
      id: inventoryBalances.id,
      itemType: inventoryBalances.itemType,
      materialId: inventoryBalances.materialId,
      materialCode: materials.code,
      materialName: materials.name,
      variantId: inventoryBalances.variantId,
      variantSku: productVariants.variantSku,
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
      unitCode: unitsOfMeasure.code,
      minimumStock: materials.minimumStock,
      quantityOnHand: inventoryBalances.quantityOnHand,
      quantityReserved: inventoryBalances.quantityReserved,
      locationId: inventoryBalances.locationId,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      warehouseId: warehouses.id,
      warehouseName: warehouses.name,
      updatedAt: inventoryBalances.updatedAt,
      totalCount: sql<number>`count(*) over ()::int`,
    })
    .from(inventoryBalances)
    .leftJoin(materials, eq(inventoryBalances.materialId, materials.id))
    .leftJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .leftJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventoryBalances.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id));

  const rows = await query
    .where(where)
    .orderBy(
      asc(inventoryBalances.itemType),
      asc(materials.code),
      asc(productVariants.variantSku),
      asc(warehouses.name),
      asc(warehouseLocations.code),
    )
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const [lowRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(materials)
    .where(
      and(
        eq(materials.isActive, true),
        sql`${materials.minimumStock} > 0`,
        sql`coalesce((select sum(b.quantity_on_hand) from inventory_balances b where b.material_id = ${materials.id}), 0) < ${materials.minimumStock}`,
      ),
    );

  return {
    items: rows.map((row) => ({
      ...row,
      quantityAvailable: String(Number(row.quantityOnHand) - Number(row.quantityReserved)),
    })),
    total: rows[0]?.totalCount ?? 0,
    lowStockCount: Number(lowRow?.value ?? 0),
  };
}

export type InventoryTransactionListRow = {
  id: string;
  number: string;
  itemType: InventoryItemTypeName;
  materialId: string | null;
  materialCode: string | null;
  materialName: string | null;
  variantId: string | null;
  variantSku: string | null;
  productName: string | null;
  transactionType: InventoryTransaction["transactionType"];
  quantity: string;
  fromLocationId: string | null;
  fromLocationLabel: string | null;
  toLocationId: string | null;
  toLocationLabel: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  postedAt: Date;
  postedByName: string | null;
};

function jakartaDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

function jakartaDayEndExclusive(date: string): Date {
  return new Date(jakartaDayStart(date).getTime() + 24 * 60 * 60 * 1000);
}

export async function listInventoryTransactions(
  params: ListInventoryTransactionsQuery,
): Promise<{ items: InventoryTransactionListRow[]; total: number }> {
  const fromLocation = alias(warehouseLocations, "from_location");
  const toLocation = alias(warehouseLocations, "to_location");
  const fromWarehouse = alias(warehouses, "from_warehouse");
  const toWarehouse = alias(warehouses, "to_warehouse");

  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(inventoryTransactions.number, pattern),
        ilike(materials.code, pattern),
        ilike(materials.name, pattern),
        ilike(productVariants.variantSku, pattern),
        ilike(products.name, pattern),
        ilike(inventoryTransactions.notes, pattern),
      ),
    );
  }
  if (params.type !== "all") conditions.push(eq(inventoryTransactions.transactionType, params.type));
  if (params.itemType !== "all") conditions.push(eq(inventoryTransactions.itemType, params.itemType));
  if (params.location) {
    conditions.push(
      or(
        eq(inventoryTransactions.fromLocationId, params.location),
        eq(inventoryTransactions.toLocationId, params.location),
      ),
    );
  }
  if (params.from) conditions.push(gte(inventoryTransactions.postedAt, jakartaDayStart(params.from)));
  if (params.to) conditions.push(lt(inventoryTransactions.postedAt, jakartaDayEndExclusive(params.to)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const from = db
    .select({
      id: inventoryTransactions.id,
      number: inventoryTransactions.number,
      itemType: inventoryTransactions.itemType,
      materialId: inventoryTransactions.materialId,
      materialCode: materials.code,
      materialName: materials.name,
      variantId: inventoryTransactions.variantId,
      variantSku: productVariants.variantSku,
      productName: products.name,
      transactionType: inventoryTransactions.transactionType,
      quantity: inventoryTransactions.quantity,
      fromLocationId: inventoryTransactions.fromLocationId,
      fromLocationLabel: sql<
        string | null
      >`case when ${fromLocation.id} is null then null else ${fromWarehouse.name} || ' / ' || ${fromLocation.code} end`,
      toLocationId: inventoryTransactions.toLocationId,
      toLocationLabel: sql<
        string | null
      >`case when ${toLocation.id} is null then null else ${toWarehouse.name} || ' / ' || ${toLocation.code} end`,
      referenceType: inventoryTransactions.referenceType,
      referenceId: inventoryTransactions.referenceId,
      notes: inventoryTransactions.notes,
      postedAt: inventoryTransactions.postedAt,
      postedByName: user.name,
      totalCount: sql<number>`count(*) over ()::int`,
    })
    .from(inventoryTransactions)
    .leftJoin(materials, eq(inventoryTransactions.materialId, materials.id))
    .leftJoin(productVariants, eq(inventoryTransactions.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(fromLocation, eq(inventoryTransactions.fromLocationId, fromLocation.id))
    .leftJoin(fromWarehouse, eq(fromLocation.warehouseId, fromWarehouse.id))
    .leftJoin(toLocation, eq(inventoryTransactions.toLocationId, toLocation.id))
    .leftJoin(toWarehouse, eq(toLocation.warehouseId, toWarehouse.id))
    .leftJoin(user, eq(inventoryTransactions.postedBy, user.id));

  const rows = await from
    .where(where)
    .orderBy(desc(inventoryTransactions.postedAt), desc(inventoryTransactions.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items: rows, total: rows[0]?.totalCount ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Operasi stok manual (F3 task 3.7 & 3.8)                             */
/* ------------------------------------------------------------------ */

type ResolvedItem =
  | { itemType: "MATERIAL"; materialId: string; variantId: null; label: string; unitCode: string }
  | {
      itemType: "FINISHED_GOOD";
      materialId: null;
      variantId: string;
      label: string;
      unitCode: string;
    };

/** Bentuk referensi item yang diterima engine (discriminated union). */
function toEngineItemRef(
  item: ResolvedItem,
):
  | { itemType: "MATERIAL"; materialId: string; variantId: null }
  | { itemType: "FINISHED_GOOD"; variantId: string; materialId: null } {
  return item.itemType === "MATERIAL"
    ? { itemType: "MATERIAL", materialId: item.materialId, variantId: null }
    : { itemType: "FINISHED_GOOD", variantId: item.variantId, materialId: null };
}

/** Validasi item (material/varian) ada dan aktif untuk operasi stok manual. */
async function resolveItemRef(
  tx: DbTransaction,
  input: { itemType: "MATERIAL" | "FINISHED_GOOD"; materialId?: string; variantId?: string },
): Promise<ResolvedItem> {
  if (input.itemType === "MATERIAL") {
    const [material] = await tx
      .select({
        id: materials.id,
        code: materials.code,
        name: materials.name,
        isActive: materials.isActive,
        unitCode: unitsOfMeasure.code,
      })
      .from(materials)
      .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
      .where(eq(materials.id, input.materialId!))
      .limit(1);
    if (!material) throw ApiError.badRequest("Material tidak ditemukan.");
    if (!material.isActive) throw ApiError.badRequest(`Material ${material.name} sedang nonaktif.`);
    return {
      itemType: "MATERIAL",
      materialId: material.id,
      variantId: null,
      label: `${material.name} (${material.code})`,
      unitCode: material.unitCode,
    };
  }

  const [variant] = await tx
    .select({
      id: productVariants.id,
      variantSku: productVariants.variantSku,
      size: productVariants.size,
      color: productVariants.color,
      isActive: productVariants.isActive,
      productName: products.name,
      productActive: products.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(productVariants.id, input.variantId!))
    .limit(1);
  if (!variant) throw ApiError.badRequest("Varian produk tidak ditemukan.");
  if (!variant.isActive || !variant.productActive) {
    throw ApiError.badRequest(`Varian ${variant.variantSku} sedang nonaktif.`);
  }
  return {
    itemType: "FINISHED_GOOD",
    materialId: null,
    variantId: variant.id,
    label: `${variant.productName} — ${variant.size}/${variant.color} (${variant.variantSku})`,
    unitCode: "pcs",
  };
}

async function assertLocationsActive(
  tx: DbTransaction,
  locationIds: string[],
): Promise<Map<string, { code: string; name: string }>> {
  const rows = await tx
    .select({
      id: warehouseLocations.id,
      code: warehouseLocations.code,
      name: warehouseLocations.name,
      isActive: warehouseLocations.isActive,
    })
    .from(warehouseLocations)
    .where(inArray(warehouseLocations.id, locationIds));

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const locationId of locationIds) {
    const location = byId.get(locationId);
    if (!location) throw ApiError.badRequest("Lokasi gudang tidak ditemukan.");
    if (!location.isActive) {
      throw ApiError.badRequest(`Lokasi ${location.code} sedang nonaktif.`);
    }
  }
  return new Map(rows.map((row) => [row.id, { code: row.code, name: row.name }]));
}

/** Transfer stok antar lokasi (F3 task 3.7) — atomik dua sisi lewat engine. */
export async function transferStock(
  input: TransferStockInput,
  actorUserId: string,
): Promise<InventoryTransaction> {
  return db.transaction(async (tx) => {
    const item = await resolveItemRef(tx, input);
    const locations = await assertLocationsActive(tx, [
      input.fromLocationId,
      input.toLocationId,
    ]);

    const result = await postMovement(tx, {
      ...toEngineItemRef(item),
      transactionType: "TRANSFER",
      quantity: input.quantity,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      referenceType: "manual-transfer",
      notes: nullable(input.notes),
      idempotencyKey: input.idempotencyKey ? `transfer:${input.idempotencyKey}` : null,
      postedBy: actorUserId,
    });

    if (result.applied) {
      await recordAudit(tx, {
        actorUserId,
        action: "inventory.transfer",
        entityType: "inventory-transaction",
        entityId: result.transaction.id,
        details: {
          number: result.transaction.number,
          item: item.label,
          quantity: input.quantity,
          from: locations.get(input.fromLocationId),
          to: locations.get(input.toLocationId),
        },
      });
    }
    return result.transaction;
  });
}

/** Penyesuaian stok dengan alasan wajib (F3 task 3.8) — selalu berjejak. */
export async function adjustStock(
  input: AdjustStockInput,
  actorUserId: string,
): Promise<InventoryTransaction> {
  return db.transaction(async (tx) => {
    const item = await resolveItemRef(tx, input);
    const locations = await assertLocationsActive(tx, [input.locationId]);
    const directionIn = input.direction === "IN";
    const notes = input.notes ? `${input.reason} — ${input.notes}` : input.reason;

    const result = await postMovement(tx, {
      ...toEngineItemRef(item),
      transactionType: directionIn ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantity: input.quantity,
      fromLocationId: directionIn ? null : input.locationId,
      toLocationId: directionIn ? input.locationId : null,
      referenceType: "manual-adjustment",
      notes,
      idempotencyKey: input.idempotencyKey ? `adjustment:${input.idempotencyKey}` : null,
      postedBy: actorUserId,
    });

    if (result.applied) {
      await recordAudit(tx, {
        actorUserId,
        action: "inventory.adjust",
        entityType: "inventory-transaction",
        entityId: result.transaction.id,
        details: {
          number: result.transaction.number,
          item: item.label,
          direction: input.direction,
          quantity: input.quantity,
          location: locations.get(input.locationId),
          reason: input.reason,
        },
      });
    }
    return result.transaction;
  });
}

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard (F3)                                            */
/* ------------------------------------------------------------------ */

export type DashboardInventorySummary = {
  /** Material aktif dengan total stok (semua lokasi) di bawah stok minimum. */
  lowStockCount: number;
  /** Jumlah baris saldo yang punya stok tersimpan (untuk tile info). */
  stockedMaterialCount: number;
};

export async function getDashboardInventorySummary(): Promise<DashboardInventorySummary> {
  const [lowRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(materials)
    .where(
      and(
        eq(materials.isActive, true),
        sql`${materials.minimumStock} > 0`,
        sql`coalesce((select sum(b.quantity_on_hand) from inventory_balances b where b.material_id = ${materials.id}), 0) < ${materials.minimumStock}`,
      ),
    );

  const [stockedRow] = await db
    .select({ value: sql<number>`count(distinct ${inventoryBalances.materialId})::int` })
    .from(inventoryBalances)
    .where(sql`${inventoryBalances.quantityOnHand} > 0`);

  return {
    lowStockCount: Number(lowRow?.value ?? 0),
    stockedMaterialCount: Number(stockedRow?.value ?? 0),
  };
}
