import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { buyers } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import type { BuyerFormInput, ListBuyersQuery, UpdateBuyerInput } from "./schemas";

export type Buyer = typeof buyers.$inferSelect;

/** "" / "   " → null agar kolom opsional bersih. */
function nullable(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listBuyers(
  params: ListBuyersQuery,
): Promise<{ items: Buyer[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(buyers.code, pattern),
        ilike(buyers.name, pattern),
        ilike(buyers.contactPerson, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(buyers.isActive, true));
  if (params.status === "inactive") conditions.push(eq(buyers.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(buyers).where(where);
  const items = await db
    .select()
    .from(buyers)
    .where(where)
    .orderBy(asc(buyers.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

/** Ambil buyer berdasarkan id; melempar 404 bila tidak ada. */
async function getBuyerRow(tx: DbTransaction, buyerId: string): Promise<Buyer> {
  const [row] = await tx.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
  if (!row) throw ApiError.notFound("Buyer tidak ditemukan.");
  return row;
}

export async function createBuyer(input: BuyerFormInput, actorUserId: string): Promise<Buyer> {
  return db.transaction(async (tx) => {
    const code = await nextDocumentNumber(tx, "BUY", { period: null });
    const [buyer] = await tx
      .insert(buyers)
      .values({
        code,
        name: input.name,
        contactPerson: nullable(input.contactPerson),
        phone: nullable(input.phone),
        email: nullable(input.email),
        address: nullable(input.address),
        notes: nullable(input.notes),
      })
      .returning();

    if (!buyer) throw ApiError.badRequest("Gagal membuat buyer.");

    await recordAudit(tx, {
      actorUserId,
      action: "buyer.create",
      entityType: "buyer",
      entityId: buyer.id,
      details: { code: buyer.code, name: buyer.name },
    });
    return buyer;
  });
}

export async function updateBuyer(
  buyerId: string,
  input: UpdateBuyerInput,
  actorUserId: string,
): Promise<Buyer> {
  return db.transaction(async (tx) => {
    const existing = await getBuyerRow(tx, buyerId);

    const updates: Partial<typeof buyers.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.contactPerson !== undefined) updates.contactPerson = nullable(input.contactPerson);
    if (input.phone !== undefined) updates.phone = nullable(input.phone);
    if (input.email !== undefined) updates.email = nullable(input.email);
    if (input.address !== undefined) updates.address = nullable(input.address);
    if (input.notes !== undefined) updates.notes = nullable(input.notes);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(buyers)
      .set(updates)
      .where(eq(buyers.id, buyerId))
      .returning();

    if (!updated) throw ApiError.notFound("Buyer tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "buyer.activate"
        : "buyer.deactivate"
      : "buyer.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "buyer",
      entityId: buyerId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
