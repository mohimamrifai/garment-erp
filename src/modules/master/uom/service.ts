import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { materials, unitsOfMeasure } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import type { ListUomsQuery, UomFormInput, UpdateUomInput } from "./schemas";

export type Uom = typeof unitsOfMeasure.$inferSelect;

export async function listUoms(
  params: ListUomsQuery,
): Promise<{ items: Uom[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(unitsOfMeasure.code, pattern), ilike(unitsOfMeasure.name, pattern)));
  }
  if (params.status === "active") conditions.push(eq(unitsOfMeasure.isActive, true));
  if (params.status === "inactive") conditions.push(eq(unitsOfMeasure.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(unitsOfMeasure).where(where);
  const items = await db
    .select()
    .from(unitsOfMeasure)
    .where(where)
    .orderBy(asc(unitsOfMeasure.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

/** Opsi untuk dropdown (hanya yang aktif). */
export async function listUomOptions(): Promise<{ id: string; code: string; name: string }[]> {
  return db
    .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
    .from(unitsOfMeasure)
    .where(eq(unitsOfMeasure.isActive, true))
    .orderBy(asc(unitsOfMeasure.code));
}

async function getUomRow(tx: DbTransaction, uomId: string): Promise<Uom> {
  const [row] = await tx
    .select()
    .from(unitsOfMeasure)
    .where(eq(unitsOfMeasure.id, uomId))
    .limit(1);
  if (!row) throw ApiError.notFound("Satuan tidak ditemukan.");
  return row;
}

export async function createUom(input: UomFormInput, actorUserId: string): Promise<Uom> {
  return db.transaction(async (tx) => {
    const code = input.code.trim().toUpperCase();

    const [existing] = await tx
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.code, code))
      .limit(1);
    if (existing) throw ApiError.conflict(`Kode satuan ${code} sudah dipakai.`);

    let uom: Uom | undefined;
    try {
      [uom] = await tx.insert(unitsOfMeasure).values({ code, name: input.name }).returning();
    } catch (error) {
      if (isUniqueViolation(error)) throw ApiError.conflict(`Kode satuan ${code} sudah dipakai.`);
      throw error;
    }
    if (!uom) throw ApiError.badRequest("Gagal membuat satuan.");

    await recordAudit(tx, {
      actorUserId,
      action: "uom.create",
      entityType: "uom",
      entityId: uom.id,
      details: { code: uom.code, name: uom.name },
    });
    return uom;
  });
}

export async function updateUom(
  uomId: string,
  input: UpdateUomInput,
  actorUserId: string,
): Promise<Uom> {
  return db.transaction(async (tx) => {
    const existing = await getUomRow(tx, uomId);

    if (input.isActive === false) {
      const [activeMaterials] = await tx
        .select({ value: count() })
        .from(materials)
        .where(and(eq(materials.unitId, uomId), eq(materials.isActive, true)));
      if (Number(activeMaterials?.value ?? 0) > 0) {
        throw ApiError.conflict(
          "Tidak dapat menonaktifkan satuan yang masih dipakai material aktif.",
        );
      }
    }

    const updates: Partial<typeof unitsOfMeasure.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(unitsOfMeasure)
      .set(updates)
      .where(eq(unitsOfMeasure.id, uomId))
      .returning();

    if (!updated) throw ApiError.notFound("Satuan tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "uom.activate"
        : "uom.deactivate"
      : "uom.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "uom",
      entityId: uomId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
