import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import {
  billsOfMaterials,
  bomItems,
  materials,
  productVariants,
  products,
  unitsOfMeasure,
} from "@/lib/db/schema";
import { getTodayDate } from "@/lib/utils/dates";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nullable } from "@/lib/utils/strings";
import type { BomCreateInput, BomItemFormInput, ListBomsQuery } from "./schemas";

export type Bom = typeof billsOfMaterials.$inferSelect;

export type BomListRow = {
  id: string;
  variantId: string;
  version: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  notes: string | null;
  createdAt: Date;
  variantSku: string;
  size: string;
  color: string;
  productName: string;
  productSku: string;
  itemCount: number;
};

export type BomItemRow = {
  id: string;
  materialId: string;
  quantityPerUnit: string;
  scrapAllowance: string;
  notes: string | null;
  materialCode: string;
  materialName: string;
  unitCode: string;
};

const bomColumns = {
  id: billsOfMaterials.id,
  variantId: billsOfMaterials.variantId,
  version: billsOfMaterials.version,
  isActive: billsOfMaterials.isActive,
  effectiveFrom: billsOfMaterials.effectiveFrom,
  effectiveUntil: billsOfMaterials.effectiveUntil,
  notes: billsOfMaterials.notes,
  createdAt: billsOfMaterials.createdAt,
  variantSku: productVariants.variantSku,
  size: productVariants.size,
  color: productVariants.color,
  productName: products.name,
  productSku: products.sku,
} as const;

export async function listBoms(
  params: ListBomsQuery,
): Promise<{ items: BomListRow[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(products.name, pattern),
        ilike(products.sku, pattern),
        ilike(productVariants.variantSku, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(billsOfMaterials.isActive, true));
  if (params.status === "draft") conditions.push(eq(billsOfMaterials.isActive, false));
  if (params.variant) conditions.push(eq(billsOfMaterials.variantId, params.variant));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(billsOfMaterials)
    .innerJoin(productVariants, eq(billsOfMaterials.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(where);

  const rows = await db
    .select({ ...bomColumns, itemCount: count(bomItems.id) })
    .from(billsOfMaterials)
    .innerJoin(productVariants, eq(billsOfMaterials.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(bomItems, eq(bomItems.bomId, billsOfMaterials.id))
    .where(where)
    .groupBy(billsOfMaterials.id, productVariants.id, products.id)
    .orderBy(desc(billsOfMaterials.createdAt), desc(billsOfMaterials.version))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({ ...row, itemCount: Number(row.itemCount) })),
    total: Number(totalRow?.value ?? 0),
  };
}

export type BomDetail = {
  bom: Bom;
  variant: { id: string; variantSku: string; size: string; color: string };
  product: { id: string; sku: string; name: string };
};

export async function getBomDetail(bomId: string): Promise<BomDetail> {
  const [row] = await db
    .select({
      bom: billsOfMaterials,
      variant: {
        id: productVariants.id,
        variantSku: productVariants.variantSku,
        size: productVariants.size,
        color: productVariants.color,
      },
      product: { id: products.id, sku: products.sku, name: products.name },
    })
    .from(billsOfMaterials)
    .innerJoin(productVariants, eq(billsOfMaterials.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(billsOfMaterials.id, bomId))
    .limit(1);

  if (!row) throw ApiError.notFound("BOM tidak ditemukan.");
  return row;
}

export async function listBomItems(bomId: string): Promise<BomItemRow[]> {
  return db
    .select({
      id: bomItems.id,
      materialId: bomItems.materialId,
      quantityPerUnit: bomItems.quantityPerUnit,
      scrapAllowance: bomItems.scrapAllowance,
      notes: bomItems.notes,
      materialCode: materials.code,
      materialName: materials.name,
      unitCode: unitsOfMeasure.code,
    })
    .from(bomItems)
    .innerJoin(materials, eq(bomItems.materialId, materials.id))
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(eq(bomItems.bomId, bomId))
    .orderBy(asc(materials.code));
}

async function getBomRow(tx: DbTransaction, bomId: string): Promise<Bom> {
  const [bom] = await tx
    .select()
    .from(billsOfMaterials)
    .where(eq(billsOfMaterials.id, bomId))
    .limit(1);
  if (!bom) throw ApiError.notFound("BOM tidak ditemukan.");
  return bom;
}

async function nextVersion(tx: DbTransaction, variantId: string): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`coalesce(max(${billsOfMaterials.version}), 0)::int` })
    .from(billsOfMaterials)
    .where(eq(billsOfMaterials.variantId, variantId));
  return Number(row?.value ?? 0) + 1;
}

/** BOM aktif bersifat beku (immutable) — ubah lewat versi baru. */
function assertDraft(bom: Bom): void {
  if (bom.isActive) {
    throw ApiError.conflict(
      "BOM aktif tidak dapat diubah. Buat versi baru untuk melakukan revisi.",
    );
  }
}

export async function createBom(input: BomCreateInput, actorUserId: string): Promise<Bom> {
  return db.transaction(async (tx) => {
    const [variant] = await tx
      .select({ id: productVariants.id, variantSku: productVariants.variantSku })
      .from(productVariants)
      .where(and(eq(productVariants.id, input.variantId), eq(productVariants.isActive, true)))
      .limit(1);
    if (!variant) throw ApiError.badRequest("Varian tidak ditemukan atau sedang nonaktif.");

    const version = await nextVersion(tx, variant.id);
    const [bom] = await tx
      .insert(billsOfMaterials)
      .values({ variantId: variant.id, version, isActive: false, notes: nullable(input.notes) })
      .returning();

    if (!bom) throw ApiError.badRequest("Gagal membuat BOM.");

    await recordAudit(tx, {
      actorUserId,
      action: "bom.create",
      entityType: "bom",
      entityId: bom.id,
      details: { variantSku: variant.variantSku, version },
    });
    return bom;
  });
}

/** Salin versi (termasuk item) menjadi draf versi berikutnya. */
export async function createBomVersion(bomId: string, actorUserId: string): Promise<Bom> {
  return db.transaction(async (tx) => {
    const source = await getBomRow(tx, bomId);
    const version = await nextVersion(tx, source.variantId);

    const [bom] = await tx
      .insert(billsOfMaterials)
      .values({
        variantId: source.variantId,
        version,
        isActive: false,
        notes: source.notes,
      })
      .returning();
    if (!bom) throw ApiError.badRequest("Gagal membuat versi BOM.");

    const items = await tx.select().from(bomItems).where(eq(bomItems.bomId, bomId));
    if (items.length > 0) {
      await tx.insert(bomItems).values(
        items.map((item) => ({
          bomId: bom.id,
          materialId: item.materialId,
          quantityPerUnit: item.quantityPerUnit,
          scrapAllowance: item.scrapAllowance,
          notes: item.notes,
        })),
      );
    }

    await recordAudit(tx, {
      actorUserId,
      action: "bom.revise",
      entityType: "bom",
      entityId: bom.id,
      details: { variantId: source.variantId, fromVersion: source.version, toVersion: version },
    });
    return bom;
  });
}

export async function addBomItem(
  bomId: string,
  input: BomItemFormInput,
  actorUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const bom = await getBomRow(tx, bomId);
    assertDraft(bom);

    const [material] = await tx
      .select({ id: materials.id, isActive: materials.isActive })
      .from(materials)
      .where(eq(materials.id, input.materialId))
      .limit(1);
    if (!material) throw ApiError.badRequest("Material tidak ditemukan.");
    if (!material.isActive) throw ApiError.badRequest("Material sedang nonaktif.");

    const [duplicate] = await tx
      .select({ id: bomItems.id })
      .from(bomItems)
      .where(and(eq(bomItems.bomId, bomId), eq(bomItems.materialId, input.materialId)))
      .limit(1);
    if (duplicate) throw ApiError.conflict("Material ini sudah ada di BOM.");

    try {
      await tx.insert(bomItems).values({
        bomId,
        materialId: input.materialId,
        quantityPerUnit: input.quantityPerUnit.toFixed(4),
        scrapAllowance: input.scrapAllowance.toFixed(4),
        notes: nullable(input.notes),
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw ApiError.conflict("Material ini sudah ada di BOM.");
      throw error;
    }

    await recordAudit(tx, {
      actorUserId,
      action: "bom-item.create",
      entityType: "bom-item",
      entityId: bomId,
      details: { materialId: input.materialId, quantityPerUnit: input.quantityPerUnit },
    });
  });
}

export async function removeBomItem(bomItemId: string, actorUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ item: bomItems, bom: billsOfMaterials })
      .from(bomItems)
      .innerJoin(billsOfMaterials, eq(bomItems.bomId, billsOfMaterials.id))
      .where(eq(bomItems.id, bomItemId))
      .limit(1);
    if (!row) throw ApiError.notFound("Item BOM tidak ditemukan.");
    assertDraft(row.bom);
    // Guard Fase 4: BOM yang sudah dipakai SPK tidak dapat diubah (cek di sini).

    await tx.delete(bomItems).where(eq(bomItems.id, bomItemId));

    await recordAudit(tx, {
      actorUserId,
      action: "bom-item.delete",
      entityType: "bom-item",
      entityId: bomItemId,
      details: { bomId: row.bom.id, materialId: row.item.materialId },
    });
  });
}

export async function activateBom(bomId: string, actorUserId: string): Promise<Bom> {
  return db.transaction(async (tx) => {
    const bom = await getBomRow(tx, bomId);
    if (bom.isActive) throw ApiError.conflict("BOM ini sudah aktif.");

    const [itemCount] = await tx
      .select({ value: count() })
      .from(bomItems)
      .where(eq(bomItems.bomId, bomId));
    if (Number(itemCount?.value ?? 0) === 0) {
      throw ApiError.conflict("BOM tanpa item tidak dapat diaktifkan.");
    }

    const today = getTodayDate();

    const [previous] = await tx
      .select({ id: billsOfMaterials.id, version: billsOfMaterials.version })
      .from(billsOfMaterials)
      .where(
        and(eq(billsOfMaterials.variantId, bom.variantId), eq(billsOfMaterials.isActive, true)),
      )
      .limit(1);

    if (previous) {
      await tx
        .update(billsOfMaterials)
        .set({ isActive: false, effectiveUntil: today })
        .where(eq(billsOfMaterials.id, previous.id));
    }

    const [updated] = await tx
      .update(billsOfMaterials)
      .set({ isActive: true, effectiveFrom: today, effectiveUntil: null })
      .where(eq(billsOfMaterials.id, bomId))
      .returning();
    if (!updated) throw ApiError.notFound("BOM tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "bom.activate",
      entityType: "bom",
      entityId: bomId,
      details: {
        variantId: bom.variantId,
        version: bom.version,
        replacedVersion: previous?.version ?? null,
      },
    });
    return updated;
  });
}

export async function deactivateBom(bomId: string, actorUserId: string): Promise<Bom> {
  return db.transaction(async (tx) => {
    const bom = await getBomRow(tx, bomId);
    if (!bom.isActive) throw ApiError.conflict("BOM ini tidak sedang aktif.");
    // Guard Fase 4: BOM yang dipakai SPK berjalan tidak dapat dinonaktifkan.

    const [updated] = await tx
      .update(billsOfMaterials)
      .set({ isActive: false, effectiveUntil: getTodayDate() })
      .where(eq(billsOfMaterials.id, bomId))
      .returning();
    if (!updated) throw ApiError.notFound("BOM tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "bom.deactivate",
      entityType: "bom",
      entityId: bomId,
      details: { variantId: bom.variantId, version: bom.version },
    });
    return updated;
  });
}
