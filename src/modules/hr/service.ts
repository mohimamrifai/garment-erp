import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import {
  attendanceRecords,
  departments,
  employees,
  leaveRequests,
  leaveTypes,
  type AttendanceRecord,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/db/schema";
import { getTodayDate } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import { countWeekdays } from "@/modules/payroll/calc";
import type {
  AttendanceFormInput,
  LeaveRequestFormInput,
  ListAttendanceQuery,
  ListLeaveQuery,
  UpdateAttendanceInput,
} from "./schemas";

export const DEFAULT_LEAVE_TYPES = [
  { code: "CUTI_TAHUNAN", name: "Cuti tahunan", isPaid: true, maxDaysPerYear: 12 },
  { code: "SAKIT", name: "Sakit", isPaid: true, maxDaysPerYear: 30 },
  { code: "IZIN", name: "Izin", isPaid: true, maxDaysPerYear: 6 },
  { code: "CUTI_TIDAK_DIBAYAR", name: "Cuti tidak dibayar", isPaid: false, maxDaysPerYear: 30 },
] as const;

export async function ensureLeaveTypes(executor: DbExecutor): Promise<void> {
  await executor
    .insert(leaveTypes)
    .values(
      DEFAULT_LEAVE_TYPES.map((type) => ({
        code: type.code,
        name: type.name,
        isPaid: type.isPaid,
        maxDaysPerYear: type.maxDaysPerYear,
      })),
    )
    .onConflictDoNothing({ target: leaveTypes.code });
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export type AttendanceListRow = AttendanceRecord & {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
};

export async function listAttendance(
  params: ListAttendanceQuery,
): Promise<{ items: AttendanceListRow[]; total: number }> {
  const month = params.month ?? getTodayDate().slice(0, 7);
  const { startDate, endDate } = monthBounds(month);

  const conditions = [
    gte(attendanceRecords.attendanceDate, startDate),
    lte(attendanceRecords.attendanceDate, endDate),
  ];
  if (params.employeeId) conditions.push(eq(attendanceRecords.employeeId, params.employeeId));
  if (params.status !== "all") conditions.push(eq(attendanceRecords.status, params.status));
  const where = and(...conditions);

  const [totalRow] = await db.select({ value: count() }).from(attendanceRecords).where(where);
  const rows = await db
    .select({
      record: attendanceRecords,
      employeeCode: employees.code,
      employeeName: employees.name,
      departmentName: departments.name,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .where(where)
    .orderBy(desc(attendanceRecords.attendanceDate), asc(employees.code))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({
      ...row.record,
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

async function assertEmployee(executor: DbExecutor, employeeId: string): Promise<void> {
  const [employee] = await executor
    .select({ id: employees.id, status: employees.employmentStatus })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!employee) throw ApiError.badRequest("Karyawan tidak ditemukan.");
  if (employee.status !== "ACTIVE") throw ApiError.badRequest("Karyawan sedang nonaktif.");
}

export async function createAttendance(
  input: AttendanceFormInput,
  actorUserId: string,
): Promise<AttendanceRecord> {
  return db.transaction(async (tx) => {
    await assertEmployee(tx, input.employeeId);
    const [existing] = await tx
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeId, input.employeeId),
          eq(attendanceRecords.attendanceDate, input.attendanceDate),
        ),
      )
      .limit(1);
    if (existing) {
      throw ApiError.conflict("Absensi karyawan pada tanggal tersebut sudah ada.");
    }

    const [record] = await tx
      .insert(attendanceRecords)
      .values({
        employeeId: input.employeeId,
        attendanceDate: input.attendanceDate,
        status: input.status,
        checkIn: nullable(input.checkIn),
        checkOut: nullable(input.checkOut),
        overtimeHours: input.overtimeHours.toFixed(2),
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!record) throw ApiError.badRequest("Gagal menyimpan absensi.");

    await recordAudit(tx, {
      actorUserId,
      action: "attendance.create",
      entityType: "attendance",
      entityId: record.id,
      details: {
        employeeId: input.employeeId,
        date: input.attendanceDate,
        status: input.status,
      },
    });
    return record;
  });
}

export async function updateAttendance(
  attendanceId: string,
  input: UpdateAttendanceInput,
  actorUserId: string,
): Promise<AttendanceRecord> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, attendanceId))
      .limit(1)
      .for("update");
    if (!existing) throw ApiError.notFound("Absensi tidak ditemukan.");

    if (input.employeeId !== undefined) await assertEmployee(tx, input.employeeId);
    if (input.attendanceDate !== undefined || input.employeeId !== undefined) {
      const employeeId = input.employeeId ?? existing.employeeId;
      const date = input.attendanceDate ?? existing.attendanceDate;
      const [duplicate] = await tx
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, employeeId),
            eq(attendanceRecords.attendanceDate, date),
            sql`${attendanceRecords.id} <> ${attendanceId}`,
          ),
        )
        .limit(1);
      if (duplicate) throw ApiError.conflict("Absensi karyawan pada tanggal tersebut sudah ada.");
    }

    const updates: Partial<typeof attendanceRecords.$inferInsert> = {};
    if (input.employeeId !== undefined) updates.employeeId = input.employeeId;
    if (input.attendanceDate !== undefined) updates.attendanceDate = input.attendanceDate;
    if (input.status !== undefined) updates.status = input.status;
    if (input.checkIn !== undefined) updates.checkIn = nullable(input.checkIn);
    if (input.checkOut !== undefined) updates.checkOut = nullable(input.checkOut);
    if (input.overtimeHours !== undefined) updates.overtimeHours = input.overtimeHours.toFixed(2);
    if (input.notes !== undefined) updates.notes = nullable(input.notes);
    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(attendanceRecords)
      .set(updates)
      .where(eq(attendanceRecords.id, attendanceId))
      .returning();
    if (!updated) throw ApiError.notFound("Absensi tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "attendance.update",
      entityType: "attendance",
      entityId: attendanceId,
      details: { changes: updates },
    });
    return updated;
  });
}

export async function deleteAttendance(
  attendanceId: string,
  actorUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, attendanceId))
      .limit(1)
      .for("update");
    if (!existing) throw ApiError.notFound("Absensi tidak ditemukan.");
    await tx.delete(attendanceRecords).where(eq(attendanceRecords.id, attendanceId));
    await recordAudit(tx, {
      actorUserId,
      action: "attendance.delete",
      entityType: "attendance",
      entityId: attendanceId,
      details: {
        employeeId: existing.employeeId,
        date: existing.attendanceDate,
        status: existing.status,
      },
    });
  });
}

export type LeaveRequestListRow = LeaveRequest & {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  leaveTypeName: string;
  isPaid: boolean;
};

export async function listLeaveRequests(
  params: ListLeaveQuery,
): Promise<{ items: LeaveRequestListRow[]; total: number }> {
  await ensureLeaveTypes(db);
  const conditions = [];
  if (params.status !== "all") conditions.push(eq(leaveRequests.status, params.status));
  if (params.employeeId) conditions.push(eq(leaveRequests.employeeId, params.employeeId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(leaveRequests).where(where);
  const rows = await db
    .select({
      request: leaveRequests,
      employeeCode: employees.code,
      employeeName: employees.name,
      departmentName: departments.name,
      leaveTypeName: leaveTypes.name,
      isPaid: leaveTypes.isPaid,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(where)
    .orderBy(desc(leaveRequests.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({
      ...row.request,
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      leaveTypeName: row.leaveTypeName,
      isPaid: row.isPaid,
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  await ensureLeaveTypes(db);
  return db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.isActive, true))
    .orderBy(asc(leaveTypes.name));
}

export async function createLeaveRequest(
  input: LeaveRequestFormInput,
  actorUserId: string,
): Promise<LeaveRequest> {
  return db.transaction(async (tx) => {
    await assertEmployee(tx, input.employeeId);
    const [leaveType] = await tx
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, input.leaveTypeId))
      .limit(1);
    if (!leaveType) throw ApiError.badRequest("Jenis cuti tidak ditemukan.");
    if (!leaveType.isActive) throw ApiError.badRequest("Jenis cuti sedang nonaktif.");

    const days = countWeekdays(input.startDate, input.endDate);
    if (days <= 0) {
      throw ApiError.badRequest("Rentang cuti tidak memiliki hari kerja.");
    }

    const [overlap] = await tx
      .select({ id: leaveRequests.id, number: leaveRequests.number })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, input.employeeId),
          inArray(leaveRequests.status, ["PENDING", "APPROVED"]),
          lte(leaveRequests.startDate, input.endDate),
          gte(leaveRequests.endDate, input.startDate),
        ),
      )
      .limit(1);
    if (overlap) {
      throw ApiError.conflict(`Tanggal cuti beririsan dengan pengajuan ${overlap.number}.`);
    }

    const number = await nextDocumentNumber(tx, "CUTI", {
      period: input.startDate.slice(0, 7).replace("-", ""),
    });
    const [request] = await tx
      .insert(leaveRequests)
      .values({
        number,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        reason: input.reason,
        status: "PENDING",
        createdBy: actorUserId,
      })
      .returning();
    if (!request) throw ApiError.badRequest("Gagal membuat pengajuan cuti.");

    await recordAudit(tx, {
      actorUserId,
      action: "leave.create",
      entityType: "leave-request",
      entityId: request.id,
      details: {
        number: request.number,
        employeeId: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        isPaid: leaveType.isPaid,
      },
    });
    return request;
  });
}

export async function approveLeaveRequest(
  leaveRequestId: string,
  actorUserId: string,
): Promise<LeaveRequest> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, leaveRequestId))
      .limit(1)
      .for("update");
    if (!request) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    if (request.status !== "PENDING") {
      throw ApiError.conflict("Hanya pengajuan berstatus menunggu yang dapat disetujui.");
    }
    const [updated] = await tx
      .update(leaveRequests)
      .set({ status: "APPROVED", approvedBy: actorUserId, approvedAt: new Date() })
      .where(eq(leaveRequests.id, leaveRequestId))
      .returning();
    if (!updated) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    await recordAudit(tx, {
      actorUserId,
      action: "leave.approve",
      entityType: "leave-request",
      entityId: leaveRequestId,
      details: { number: request.number, employeeId: request.employeeId },
    });
    return updated;
  });
}

export async function rejectLeaveRequest(
  leaveRequestId: string,
  reason: string,
  actorUserId: string,
): Promise<LeaveRequest> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, leaveRequestId))
      .limit(1)
      .for("update");
    if (!request) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    if (request.status !== "PENDING") {
      throw ApiError.conflict("Hanya pengajuan berstatus menunggu yang dapat ditolak.");
    }
    const [updated] = await tx
      .update(leaveRequests)
      .set({
        status: "REJECTED",
        approvedBy: actorUserId,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(leaveRequests.id, leaveRequestId))
      .returning();
    if (!updated) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    await recordAudit(tx, {
      actorUserId,
      action: "leave.reject",
      entityType: "leave-request",
      entityId: leaveRequestId,
      details: { number: request.number, reason },
    });
    return updated;
  });
}

export async function cancelLeaveRequest(
  leaveRequestId: string,
  actorUserId: string,
): Promise<LeaveRequest> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, leaveRequestId))
      .limit(1)
      .for("update");
    if (!request) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    if (request.status === "CANCELLED" || request.status === "REJECTED") {
      throw ApiError.conflict("Pengajuan ini sudah tidak aktif.");
    }
    const [updated] = await tx
      .update(leaveRequests)
      .set({ status: "CANCELLED" })
      .where(eq(leaveRequests.id, leaveRequestId))
      .returning();
    if (!updated) throw ApiError.notFound("Pengajuan cuti tidak ditemukan.");
    await recordAudit(tx, {
      actorUserId,
      action: "leave.cancel",
      entityType: "leave-request",
      entityId: leaveRequestId,
      details: { number: request.number },
    });
    return updated;
  });
}

export async function listEmployeeOptions(): Promise<
  { id: string; code: string; name: string; departmentName: string }[]
> {
  const rows = await db
    .select({
      id: employees.id,
      code: employees.code,
      name: employees.name,
      departmentName: departments.name,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.employmentStatus, "ACTIVE"))
    .orderBy(asc(employees.name));
  return rows;
}
