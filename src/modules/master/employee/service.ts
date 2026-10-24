import { and, asc, count, eq, getTableColumns, ilike, or } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbTransaction } from "@/lib/db";
import { departments, employees } from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import type { EmployeeFormInput, ListEmployeesQuery, UpdateEmployeeInput } from "./schemas";

export type Employee = typeof employees.$inferSelect;

export type EmployeeListRow = Employee & {
  departmentCode: string;
  departmentName: string;
};

function money(value: number): string {
  return value.toFixed(2);
}

export async function listEmployees(
  params: ListEmployeesQuery,
): Promise<{ items: EmployeeListRow[]; total: number }> {
  const conditions = [];

  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(employees.code, pattern),
        ilike(employees.name, pattern),
        ilike(employees.jobTitle, pattern),
      ),
    );
  }
  if (params.status === "active") conditions.push(eq(employees.employmentStatus, "ACTIVE"));
  if (params.status === "inactive") conditions.push(eq(employees.employmentStatus, "INACTIVE"));
  if (params.department) conditions.push(eq(employees.departmentId, params.department));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(employees).where(where);
  const items = await db
    .select({
      ...getTableColumns(employees),
      departmentCode: departments.code,
      departmentName: departments.name,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .where(where)
    .orderBy(asc(employees.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { items, total: Number(totalRow?.value ?? 0) };
}

async function getEmployeeRow(tx: DbTransaction, employeeId: string): Promise<Employee> {
  const [row] = await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!row) throw ApiError.notFound("Karyawan tidak ditemukan.");
  return row;
}

export async function createEmployee(
  input: EmployeeFormInput,
  actorUserId: string,
): Promise<Employee> {
  return db.transaction(async (tx) => {
    const [department] = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);
    if (!department) throw ApiError.badRequest("Departemen tidak ditemukan.");

    const code = await nextDocumentNumber(tx, "EMP", { period: null });
    const [employee] = await tx
      .insert(employees)
      .values({
        code,
        name: input.name,
        departmentId: input.departmentId,
        jobTitle: input.jobTitle,
        phone: nullable(input.phone),
        email: nullable(input.email),
        joinDate: nullable(input.joinDate),
        employmentType: input.employmentType,
        contractStartDate: nullable(input.contractStartDate),
        contractEndDate: nullable(input.contractEndDate),
        resignDate: nullable(input.resignDate),
        birthDate: nullable(input.birthDate),
        address: nullable(input.address),
        basicSalary: money(input.basicSalary),
        fixedAllowance: money(input.fixedAllowance),
        bankName: nullable(input.bankName),
        bankAccountNumber: nullable(input.bankAccountNumber),
        bankAccountName: nullable(input.bankAccountName),
        npwp: nullable(input.npwp),
        bpjsKesehatanNumber: nullable(input.bpjsKesehatanNumber),
        bpjsKetenagakerjaanNumber: nullable(input.bpjsKetenagakerjaanNumber),
        taxStatus: input.taxStatus,
      })
      .returning();

    if (!employee) throw ApiError.badRequest("Gagal membuat karyawan.");

    await recordAudit(tx, {
      actorUserId,
      action: "employee.create",
      entityType: "employee",
      entityId: employee.id,
      details: { code: employee.code, name: employee.name },
    });
    return employee;
  });
}

export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput,
  actorUserId: string,
): Promise<Employee> {
  return db.transaction(async (tx) => {
    const existing = await getEmployeeRow(tx, employeeId);

    const updates: Partial<typeof employees.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.jobTitle !== undefined) updates.jobTitle = input.jobTitle;
    if (input.phone !== undefined) updates.phone = nullable(input.phone);
    if (input.email !== undefined) updates.email = nullable(input.email);
    if (input.employmentStatus !== undefined) updates.employmentStatus = input.employmentStatus;
    if (input.joinDate !== undefined) updates.joinDate = nullable(input.joinDate);
    if (input.employmentType !== undefined) updates.employmentType = input.employmentType;
    if (input.contractStartDate !== undefined) {
      updates.contractStartDate = nullable(input.contractStartDate);
    }
    if (input.contractEndDate !== undefined) {
      updates.contractEndDate = nullable(input.contractEndDate);
    }
    if (input.resignDate !== undefined) updates.resignDate = nullable(input.resignDate);
    if (input.birthDate !== undefined) updates.birthDate = nullable(input.birthDate);
    if (input.address !== undefined) updates.address = nullable(input.address);
    if (input.basicSalary !== undefined) updates.basicSalary = money(input.basicSalary);
    if (input.fixedAllowance !== undefined) updates.fixedAllowance = money(input.fixedAllowance);
    if (input.bankName !== undefined) updates.bankName = nullable(input.bankName);
    if (input.bankAccountNumber !== undefined) {
      updates.bankAccountNumber = nullable(input.bankAccountNumber);
    }
    if (input.bankAccountName !== undefined) {
      updates.bankAccountName = nullable(input.bankAccountName);
    }
    if (input.npwp !== undefined) updates.npwp = nullable(input.npwp);
    if (input.bpjsKesehatanNumber !== undefined) {
      updates.bpjsKesehatanNumber = nullable(input.bpjsKesehatanNumber);
    }
    if (input.bpjsKetenagakerjaanNumber !== undefined) {
      updates.bpjsKetenagakerjaanNumber = nullable(input.bpjsKetenagakerjaanNumber);
    }
    if (input.taxStatus !== undefined) updates.taxStatus = input.taxStatus;
    if (input.departmentId !== undefined) {
      const [department] = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, input.departmentId))
        .limit(1);
      if (!department) throw ApiError.badRequest("Departemen tidak ditemukan.");
      updates.departmentId = input.departmentId;
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(employees)
      .set(updates)
      .where(eq(employees.id, employeeId))
      .returning();

    if (!updated) throw ApiError.notFound("Karyawan tidak ditemukan.");

    const onlyStatusChange =
      input.employmentStatus !== undefined && Object.keys(updates).length === 1;
    const action = onlyStatusChange
      ? input.employmentStatus === "ACTIVE"
        ? "employee.activate"
        : "employee.deactivate"
      : "employee.update";

    await recordAudit(tx, {
      actorUserId,
      action,
      entityType: "employee",
      entityId: employeeId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}
