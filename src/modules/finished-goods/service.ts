import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor, type DbTransaction } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  finishedGoods,
  inventoryBalances,
  productVariants,
  productionOrders,
  products,
  qcInspections,
  shipmentItems,
  shipments as shipmentsTable,
  warehouseLocations,
  warehouses,
  type FinishedGoodsLot,
} from "@/lib/db/schema";
import { nullable } from "@/lib/utils/strings";
import { postMovement } from "@/modules/inventory/engine";
import type { ListFinishedGoodsQuery } from "./schemas";

/**
 * Modul barang jadi (PRD FR-10, F5 task 5.1–5.2).
 *
 * Saldo barang jadi **hanya** bersumber dari inventory engine (`item_type =
 * FINISHED_GOOD`); tabel `finished_goods` menyimpan lot untuk traceability
 * (varian, lokasi, SPK, inspeksi QC akhir). Satu inspeksi PASS menghasilkan
 * maksimal satu lot (UNIQUE) sekaligus satu penerimaan stok — idempoten bila
 * permintaan diulang.
 *
 * Barang jadi hanya masuk setelah inspeksi QC akhir (tahap packing) berstatus
 * lolos; belum lolos QC akhir = belum punya saldo = tidak dapat dialokasikan
 * atau dikirim (dijaga oleh ketersediaan stok di engine).
 */

/**
 * Lokasi penyimpanan barang jadi. Konvensi: lokasi aktif berkode `B-01`
 * ("Area Produk Jadi" pada data contoh), lalu lokasi aktif pertama yang
 * namanya memuat "produk jadi", terakhir lokasi aktif pertama (urut gudang).
 */
export async function resolveFinishedGoodsLocationId(executor: DbExecutor): Promise<string> {
  const [byCode] = await executor
    .select({ id: warehouseLocations.id })
    .from(warehouseLocations)
    .where(and(eq(warehouseLocations.isActive, true), eq(warehouseLocations.code, "B-01")))
    .limit(1);
  if (byCode) return byCode.id;

  const [byName] = await executor
    .select({ id: warehouseLocations.id })
    .from(warehouseLocations)
    .where(
      and(eq(warehouseLocations.isActive, true), ilike(warehouseLocations.name, "%produk jadi%")),
    )
    .orderBy(asc(warehouseLocations.code))
    .limit(1);
  if (byName) return byName.id;

  const [first] = await executor
    .select({ id: warehouseLocations.id })
    .from(warehouseLocations)
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(and(eq(warehouseLocations.isActive, true), eq(warehouses.isActive, true)))
    .orderBy(asc(warehouses.name), asc(warehouseLocations.code))
    .limit(1);
  if (!first) {
    throw ApiError.conflict(
      "Belum ada lokasi gudang aktif. Tambahkan lokasi penyimpanan barang jadi terlebih dahulu.",
    );
  }
  return first.id;
}

export type RecordFinishedGoodsLotInput = {
  productionOrderId: string;
  qcInspectionId: string;
  variantId: string;
  quantity: number;
  createdBy: string | null;
  notes?: string | null;
};

export type RecordFinishedGoodsLotResult = {
  lot: FinishedGoodsLot;
  /** false = lot sudah pernah tercatat (permintaan diulang). */
  created: boolean;
};

/**
 * Catat lot barang jadi + penerimaan stok via engine (dipanggil di dalam
 * transaksi yang sama dengan inspeksi QC akhir yang lolos).
 */
export async function recordFinishedGoodsLot(
  tx: DbTransaction,
  input: RecordFinishedGoodsLotInput,
): Promise<RecordFinishedGoodsLotResult> {
  if (input.quantity <= 0) {
    throw ApiError.badRequest("Kuantitas barang jadi harus lebih dari 0.");
  }

  const locationId = await resolveFinishedGoodsLocationId(tx);

  const [inserted] = await tx
    .insert(finishedGoods)
    .values({
      variantId: input.variantId,
      locationId,
      productionOrderId: input.productionOrderId,
      qcInspectionId: input.qcInspectionId,
      quantity: String(input.quantity),
      notes: nullable(input.notes),
      createdBy: input.createdBy,
    })
    .onConflictDoNothing({ target: finishedGoods.qcInspectionId })
    .returning();

  if (!inserted) {
    // Inspeksi ini sudah punya lot (permintaan diulang) — saldo juga sudah ada.
    const [existing] = await tx
      .select()
      .from(finishedGoods)
      .where(eq(finishedGoods.qcInspectionId, input.qcInspectionId))
      .limit(1);
    if (!existing) throw ApiError.badRequest("Gagal menyimpan lot barang jadi.");
    return { lot: existing, created: false };
  }

  await postMovement(tx, {
    itemType: "FINISHED_GOOD",
    variantId: input.variantId,
    transactionType: "RECEIPT",
    quantity: input.quantity,
    toLocationId: locationId,
    referenceType: "qc-inspection",
    referenceId: input.qcInspectionId,
    notes: nullable(input.notes) ?? "Barang jadi lolos QC akhir.",
    idempotencyKey: `fg:${input.qcInspectionId}`,
    postedBy: input.createdBy,
  });

  await recordAudit(tx, {
    actorUserId: input.createdBy,
    action: "finished-goods.receive",
    entityType: "finished-goods-lot",
    entityId: inserted.id,
    details: {
      productionOrderId: input.productionOrderId,
      qcInspectionId: input.qcInspectionId,
      variantId: input.variantId,
      locationId,
      quantity: input.quantity,
    },
  });

  return { lot: inserted, created: true };
}

/* ------------------------------------------------------------------ */
/* Query baca: saldo barang jadi                                       */
/* ------------------------------------------------------------------ */

export type FinishedGoodsStockRow = {
  id: string;
  variantId: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  warehouseName: string;
  updatedAt: Date;
};

export async function listFinishedGoodsStock(params: ListFinishedGoodsQuery): Promise<{
  items: FinishedGoodsStockRow[];
  total: number;
  totals: { onHand: number; available: number; variantCount: number };
}> {
  const conditions = [eq(inventoryBalances.itemType, "FINISHED_GOOD")];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(productVariants.variantSku, pattern),
        ilike(products.name, pattern),
        ilike(products.sku, pattern),
      )!,
    );
  }
  if (params.warehouse) conditions.push(eq(warehouses.id, params.warehouse));
  if (params.location) conditions.push(eq(inventoryBalances.locationId, params.location));

  const where = and(...conditions);

  const rows = await db
    .select({
      id: inventoryBalances.id,
      variantId: inventoryBalances.variantId,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      quantityOnHand: inventoryBalances.quantityOnHand,
      quantityReserved: inventoryBalances.quantityReserved,
      locationId: inventoryBalances.locationId,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      warehouseName: warehouses.name,
      updatedAt: inventoryBalances.updatedAt,
      totalCount: sql<number>`count(*) over ()::int`,
    })
    .from(inventoryBalances)
    .innerJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventoryBalances.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(where)
    .orderBy(
      asc(products.name),
      asc(productVariants.size),
      asc(productVariants.color),
      asc(warehouses.name),
      asc(warehouseLocations.code),
    )
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const [summary] = await db
    .select({
      onHand: sql<string>`coalesce(sum(${inventoryBalances.quantityOnHand}), 0)`,
      reserved: sql<string>`coalesce(sum(${inventoryBalances.quantityReserved}), 0)`,
      variantCount: sql<number>`count(distinct case when ${inventoryBalances.quantityOnHand} > 0 then ${inventoryBalances.variantId} end)::int`,
    })
    .from(inventoryBalances)
    .innerJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(warehouseLocations, eq(inventoryBalances.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .where(where);

  const onHand = Number(summary?.onHand ?? 0);
  const reserved = Number(summary?.reserved ?? 0);

  return {
    items: rows
      .filter((row): row is typeof row & { variantId: string } => row.variantId !== null)
      .map((row) => ({
        ...row,
        quantityAvailable: String(Number(row.quantityOnHand) - Number(row.quantityReserved)),
      })),
    total: rows[0]?.totalCount ?? 0,
    totals: { onHand, available: onHand - reserved, variantCount: Number(summary?.variantCount ?? 0) },
  };
}

/* ------------------------------------------------------------------ */
/* Query baca: riwayat lot                                             */
/* ------------------------------------------------------------------ */

export type FinishedGoodsLotRow = {
  id: string;
  quantity: string;
  createdAt: Date;
  variantId: string;
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  locationCode: string;
  locationName: string;
  warehouseName: string;
  productionOrderId: string;
  productionOrderNumber: string;
  qcInspectionId: string;
  qcInspectionNumber: string;
  createdByName: string | null;
  notes: string | null;
};

export async function listFinishedGoodsLots(limit = 25): Promise<FinishedGoodsLotRow[]> {
  return db
    .select({
      id: finishedGoods.id,
      quantity: finishedGoods.quantity,
      createdAt: finishedGoods.createdAt,
      variantId: finishedGoods.variantId,
      variantSku: productVariants.variantSku,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      locationCode: warehouseLocations.code,
      locationName: warehouseLocations.name,
      warehouseName: warehouses.name,
      productionOrderId: finishedGoods.productionOrderId,
      productionOrderNumber: productionOrders.number,
      qcInspectionId: finishedGoods.qcInspectionId,
      qcInspectionNumber: qcInspections.number,
      createdByName: user.name,
      notes: finishedGoods.notes,
    })
    .from(finishedGoods)
    .innerJoin(productVariants, eq(finishedGoods.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(warehouseLocations, eq(finishedGoods.locationId, warehouseLocations.id))
    .innerJoin(warehouses, eq(warehouseLocations.warehouseId, warehouses.id))
    .innerJoin(productionOrders, eq(finishedGoods.productionOrderId, productionOrders.id))
    .innerJoin(qcInspections, eq(finishedGoods.qcInspectionId, qcInspections.id))
    .leftJoin(user, eq(finishedGoods.createdBy, user.id))
    .orderBy(desc(finishedGoods.createdAt), desc(finishedGoods.id))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Ringkasan dashboard (F5)                                            */
/* ------------------------------------------------------------------ */

export type DashboardFinishedGoodsSummary = {
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  variantCount: number;
  /** Pengiriman terposting bulan berjalan. */
  shipmentsThisMonth: number;
  shippedQuantityThisMonth: number;
};

export async function getDashboardFinishedGoodsSummary(): Promise<DashboardFinishedGoodsSummary> {
  const [stock] = await db
    .select({
      onHand: sql<string>`coalesce(sum(${inventoryBalances.quantityOnHand}), 0)`,
      reserved: sql<string>`coalesce(sum(${inventoryBalances.quantityReserved}), 0)`,
      variantCount: sql<number>`count(distinct case when ${inventoryBalances.quantityOnHand} > 0 then ${inventoryBalances.variantId} end)::int`,
    })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.itemType, "FINISHED_GOOD"));

  const [shipments] = await db
    .select({
      count: sql<number>`count(distinct ${shipmentsTable.id})::int`,
      quantity: sql<string>`coalesce(sum(${shipmentItems.quantity}), 0)`,
    })
    .from(shipmentsTable)
    .innerJoin(shipmentItems, eq(shipmentItems.shipmentId, shipmentsTable.id))
    .where(
      and(
        eq(shipmentsTable.status, "POSTED"),
        sql`${shipmentsTable.shippedAt} >= date_trunc('month', now())::date`,
      ),
    );

  const onHand = Number(stock?.onHand ?? 0);
  const reserved = Number(stock?.reserved ?? 0);

  return {
    totalOnHand: onHand,
    totalReserved: reserved,
    totalAvailable: onHand - reserved,
    variantCount: Number(stock?.variantCount ?? 0),
    shipmentsThisMonth: Number(shipments?.count ?? 0),
    shippedQuantityThisMonth: Number(shipments?.quantity ?? 0),
  };
}
