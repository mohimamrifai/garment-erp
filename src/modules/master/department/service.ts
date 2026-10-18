import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { departments, employees } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type {
  DepartmentFormInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from "./schemas";

export type Department = typeof departments.$inferSelect;

export async function listDepartments(
  params: ListDepartmentsQuery,
): Promise<{ items: Department[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(departments.code, pattern),
        ilike(departments.name, pattern),
        ilike(departments.description, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(departments.isActive, true));
  if (params.status === "inactive") conditions.push(eq(departments.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(departments).where(where);
  const items = await db
    .select()
    .from(departments)
    .where(where)
    .orderBy(asc(departments.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

/** Opsi untuk dropdown (hanya yang aktif), diurutkan berdasarkan nama. */
export async function listDepartmentOptions(): Promise<
  { id: string; code: string; name: string }[]
> {
  return db
    .select({ id: departments.id, code: departments.code, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(asc(departments.name));
}

async function getDepartmentRow(tx: DbTransaction, departmentId: string): Promise<Department> {
  const [row] = await tx
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);
  if (!row) throw ApiError.notFound("Departemen tidak ditemukan.");
  return row;
}

export async function createDepartment(
  input: DepartmentFormInput,
  actorUserId: string,
): Promise<Department> {
  return db.transaction(async (tx) => {
    const code = await nextDocumentNumber(tx, "DEP", { period: null });
    const [department] = await tx
      .insert(departments)
      .values({
        code,
        name: input.name,
        description: nullable(input.description),
      })
      .returning();

    if (!department) throw ApiError.badRequest("Gagal membuat departemen.");

    await recordAudit(tx, {
      actorUserId,
      action: "department.create",
      entityType: "department",
      entityId: department.id,
      details: { code: department.code, name: department.name },
    });
    return department;
  });
}

export async function updateDepartment(
  departmentId: string,
  input: UpdateDepartmentInput,
  actorUserId: string,
): Promise<Department> {
  return db.transaction(async (tx) => {
    const existing = await getDepartmentRow(tx, departmentId);

    if (input.isActive === false) {
      const [activeEmployees] = await tx
        .select({ value: count() })
        .from(employees)
        .where(
          and(eq(employees.departmentId, departmentId), eq(employees.employmentStatus, "ACTIVE")),
        );
      if (Number(activeEmployees?.value ?? 0) > 0) {
        throw ApiError.conflict(
          "Tidak dapat menonaktifkan departemen yang masih memiliki karyawan aktif.",
        );
      }
    }

    const updates: Partial<typeof departments.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = nullable(input.description);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(departments)
      .set(updates)
      .where(eq(departments.id, departmentId))
      .returning();

    if (!updated) throw ApiError.notFound("Departemen tidak ditemukan.");

    const onlyStatusChange = input.isActive !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.isActive
        ? "department.activate"
        : "department.deactivate"
      : "department.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "department",
      entityId: departmentId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
