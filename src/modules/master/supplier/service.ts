import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { suppliers } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type { ListSuppliersQuery, SupplierFormInput, UpdateSupplierInput } from "./schemas";

export type Supplier = typeof suppliers.$inferSelect;

export async function listSuppliers(
  params: ListSuppliersQuery,
): Promise<{ items: Supplier[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(suppliers.code, pattern),
        ilike(suppliers.name, pattern),
        ilike(suppliers.contactPerson, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(suppliers.isActive, true));
  if (params.status === "inactive") conditions.push(eq(suppliers.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(suppliers).where(where);
  const items = await db
    .select()
    .from(suppliers)
    .where(where)
    .orderBy(asc(suppliers.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

async function getSupplierRow(tx: DbTransaction, supplierId: string): Promise<Supplier> {
  const [row] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!row) throw ApiError.notFound("Supplier tidak ditemukan.");
  return row;
}

export async function createSupplier(
  input: SupplierFormInput,
  actorUserId: string,
): Promise<Supplier> {
  return db.transaction(async (tx) => {
    const code = await nextDocumentNumber(tx, "SUP", { period: null });
    const [supplier] = await tx
      .insert(suppliers)
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

    if (!supplier) throw ApiError.badRequest("Gagal membuat supplier.");

    await recordAudit(tx, {
      actorUserId,
      action: "supplier.create",
      entityType: "supplier",
      entityId: supplier.id,
      details: { code: supplier.code, name: supplier.name },
    });
    return supplier;
  });
}

export async function updateSupplier(
  supplierId: string,
  input: UpdateSupplierInput,
  actorUserId: string,
): Promise<Supplier> {
  return db.transaction(async (tx) => {
    const existing = await getSupplierRow(tx, supplierId);

    const updates: Partial<typeof suppliers.$inferInsert> = {};
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
      .update(suppliers)
      .set(updates)
      .where(eq(suppliers.id, supplierId))
      .returning();

    if (!updated) throw ApiError.notFound("Supplier tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "supplier.activate"
        : "supplier.deactivate"
      : "supplier.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "supplier",
      entityId: supplierId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
