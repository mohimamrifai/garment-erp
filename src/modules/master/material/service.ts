import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { billsOfMaterials, bomItems, materials, unitsOfMeasure } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type { ListMaterialsQuery, MaterialFormInput, UpdateMaterialInput } from "./schemas";

export type Material = typeof materials.$inferSelect;

export type MaterialListRow = Material & {
  unitCode: string;
  unitName: string;
};

/** 3 desimal mengikuti kolom numeric(14,3). */
function toStockString(value: number): string {
  return value.toFixed(3);
}

export async function listMaterials(
  params: ListMaterialsQuery,
): Promise<{ items: MaterialListRow[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(materials.code, pattern), ilike(materials.name, pattern), ilike(materials.notes, pattern)),
    );
  }
  if (params.status === "active") conditions.push(eq(materials.isActive, true));
  if (params.status === "inactive") conditions.push(eq(materials.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(materials).where(where);
  const items = await db
    .select({
      id: materials.id,
      code: materials.code,
      name: materials.name,
      unitId: materials.unitId,
      minimumStock: materials.minimumStock,
      notes: materials.notes,
      isActive: materials.isActive,
      createdAt: materials.createdAt,
      updatedAt: materials.updatedAt,
      unitCode: unitsOfMeasure.code,
      unitName: unitsOfMeasure.name,
    })
    .from(materials)
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(where)
    .orderBy(asc(materials.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

/** Opsi material aktif untuk editor BOM (Fase 2) dan purchase order (Fase 3). */
export async function listMaterialOptions(): Promise<
  { id: string; code: string; name: string; unitCode: string }[]
> {
  return db
    .select({
      id: materials.id,
      code: materials.code,
      name: materials.name,
      unitCode: unitsOfMeasure.code,
    })
    .from(materials)
    .innerJoin(unitsOfMeasure, eq(materials.unitId, unitsOfMeasure.id))
    .where(eq(materials.isActive, true))
    .orderBy(asc(materials.code));
}

async function getMaterialRow(tx: DbTransaction, materialId: string): Promise<Material> {
  const [row] = await tx.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  if (!row) throw ApiError.notFound("Material tidak ditemukan.");
  return row;
}

/** Guard 2.5: material yang dipakai BOM aktif tidak boleh dinonaktifkan. */
async function assertNotUsedByActiveBom(tx: DbTransaction, materialId: string): Promise<void> {
  const [used] = await tx
    .select({ value: count() })
    .from(bomItems)
    .innerJoin(billsOfMaterials, eq(bomItems.bomId, billsOfMaterials.id))
    .where(and(eq(bomItems.materialId, materialId), eq(billsOfMaterials.isActive, true)));
  if (Number(used?.value ?? 0) > 0) {
    throw ApiError.conflict(
      "Material masih dipakai pada BOM aktif. Nonaktifkan BOM terkait terlebih dahulu.",
    );
  }
}

export async function createMaterial(
  input: MaterialFormInput,
  actorUserId: string,
): Promise<Material> {
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.id, input.unitId))
      .limit(1);
    if (!unit) throw ApiError.badRequest("Satuan tidak ditemukan.");

    const code = await nextDocumentNumber(tx, "MAT", { period: null });
    const [material] = await tx
      .insert(materials)
      .values({
        code,
        name: input.name,
        unitId: input.unitId,
        minimumStock: toStockString(input.minimumStock),
        notes: nullable(input.notes),
      })
      .returning();

    if (!material) throw ApiError.badRequest("Gagal membuat material.");

    await recordAudit(tx, {
      actorUserId,
      action: "material.create",
      entityType: "material",
      entityId: material.id,
      details: { code: material.code, name: material.name },
    });
    return material;
  });
}

export async function updateMaterial(
  materialId: string,
  input: UpdateMaterialInput,
  actorUserId: string,
): Promise<Material> {
  return db.transaction(async (tx) => {
    const existing = await getMaterialRow(tx, materialId);

    if (input.isActive === false && existing.isActive) {
      await assertNotUsedByActiveBom(tx, materialId);
    }

    if (input.unitId !== undefined) {
      const [unit] = await tx
        .select({ id: unitsOfMeasure.id })
        .from(unitsOfMeasure)
        .where(eq(unitsOfMeasure.id, input.unitId))
        .limit(1);
      if (!unit) throw ApiError.badRequest("Satuan tidak ditemukan.");
    }

    const updates: Partial<typeof materials.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.unitId !== undefined) updates.unitId = input.unitId;
    if (input.minimumStock !== undefined) updates.minimumStock = toStockString(input.minimumStock);
    if (input.notes !== undefined) updates.notes = nullable(input.notes);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(materials)
      .set(updates)
      .where(eq(materials.id, materialId))
      .returning();

    if (!updated) throw ApiError.notFound("Material tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "material.activate"
        : "material.deactivate"
      : "material.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "material",
      entityId: materialId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
