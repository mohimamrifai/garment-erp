import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { productionLines } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type { LineFormInput, ListLinesQuery, UpdateLineInput } from "./schemas";

export type ProductionLine = typeof productionLines.$inferSelect;

export async function listLines(
  params: ListLinesQuery,
): Promise<{ items: ProductionLine[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(productionLines.code, pattern),
        ilike(productionLines.name, pattern),
        ilike(productionLines.notes, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(productionLines.isActive, true));
  if (params.status === "inactive") conditions.push(eq(productionLines.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(productionLines).where(where);
  const items = await db
    .select()
    .from(productionLines)
    .where(where)
    .orderBy(asc(productionLines.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

async function getLineRow(tx: DbTransaction, lineId: string): Promise<ProductionLine> {
  const [row] = await tx
    .select()
    .from(productionLines)
    .where(eq(productionLines.id, lineId))
    .limit(1);
  if (!row) throw ApiError.notFound("Lini produksi tidak ditemukan.");
  return row;
}

export async function createLine(
  input: LineFormInput,
  actorUserId: string,
): Promise<ProductionLine> {
  return db.transaction(async (tx) => {
    const code = await nextDocumentNumber(tx, "LIN", { period: null });
    const [line] = await tx
      .insert(productionLines)
      .values({ code, name: input.name, notes: nullable(input.notes) })
      .returning();

    if (!line) throw ApiError.badRequest("Gagal membuat lini produksi.");

    await recordAudit(tx, {
      actorUserId,
      action: "production-line.create",
      entityType: "production-line",
      entityId: line.id,
      details: { code: line.code, name: line.name },
    });
    return line;
  });
}

export async function updateLine(
  lineId: string,
  input: UpdateLineInput,
  actorUserId: string,
): Promise<ProductionLine> {
  return db.transaction(async (tx) => {
    const existing = await getLineRow(tx, lineId);

    const updates: Partial<typeof productionLines.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.notes !== undefined) updates.notes = nullable(input.notes);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(productionLines)
      .set(updates)
      .where(eq(productionLines.id, lineId))
      .returning();

    if (!updated) throw ApiError.notFound("Lini produksi tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "production-line.activate"
        : "production-line.deactivate"
      : "production-line.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "production-line",
      entityId: lineId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
