import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  attendanceRecords,
  departments,
  employees,
  leaveRequests,
  leaveTypes,
  payrollRuns,
  payslips,
  type PayrollRun,
  type Payslip,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { postPayrollToAccounting } from "@/modules/accounting/integration";
import { createPayment } from "@/modules/accounting/service";
import {
  computePayrollLine,
  overlapWeekdays,
  roundMoney,
  type TaxStatus,
} from "./calc";
import type {
  CreatePayrollRunInput,
  ListPayrollRunsQuery,
  PayPayrollRunInput,
} from "./schemas";

export type PayrollRunListRow = PayrollRun & {
  employeeCount: number;
};

export type PayrollRunDetail = {
  run: PayrollRun;
  payslips: Payslip[];
};

function monthBounds(period: string): { startDate: string; endDate: string } {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${period}-01`,
    endDate: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function listPayrollRuns(
  params: ListPayrollRunsQuery,
): Promise<{ items: PayrollRunListRow[]; total: number }> {
  const conditions = [];
  if (params.status !== "all") {
    conditions.push(eq(payrollRuns.status, params.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(payrollRuns).where(where);
  const rows = await db
    .select({
      run: payrollRuns,
      employeeCount: sql<number>`(select count(*)::int from payslips p where p.payroll_run_id = payroll_runs.id)`,
    })
    .from(payrollRuns)
    .where(where)
    .orderBy(desc(payrollRuns.period), desc(payrollRuns.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return {
    items: rows.map((row) => ({ ...row.run, employeeCount: Number(row.employeeCount) })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function getPayrollRunDetail(payrollRunId: string): Promise<PayrollRunDetail> {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, payrollRunId))
    .limit(1);
  if (!run) throw ApiError.notFound("Payroll tidak ditemukan.");
  const rows = await db
    .select()
    .from(payslips)
    .where(eq(payslips.payrollRunId, run.id))
    .orderBy(asc(payslips.employeeCode));
  return { run, payslips: rows };
}

/**
 * Buat payroll bulanan dari data karyawan aktif, absensi, dan cuti yang sudah
 * disetujui. Payroll baru berstatus DRAFT dan belum memengaruhi akuntansi.
 */
export async function createPayrollRun(
  input: CreatePayrollRunInput,
  actorUserId: string,
): Promise<PayrollRun> {
  return db.transaction(async (tx) => {
    const { startDate, endDate } = monthBounds(input.period);

    const [existing] = await tx
      .select({ id: payrollRuns.id, status: payrollRuns.status })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.period, input.period), sql`${payrollRuns.status} <> 'CANCELLED'`))
      .limit(1);
    if (existing) {
      throw ApiError.conflict(`Payroll periode ${input.period} sudah ada (${existing.status}).`);
    }

    const employeeRows = await tx
      .select({
        id: employees.id,
        code: employees.code,
        name: employees.name,
        departmentName: departments.name,
        jobTitle: employees.jobTitle,
        bankName: employees.bankName,
        bankAccountNumber: employees.bankAccountNumber,
        basicSalary: employees.basicSalary,
        fixedAllowance: employees.fixedAllowance,
        taxStatus: employees.taxStatus,
      })
      .from(employees)
      .innerJoin(departments, eq(employees.departmentId, departments.id))
      .where(
        and(
          eq(employees.employmentStatus, "ACTIVE"),
          or(isNull(employees.joinDate), lte(employees.joinDate, endDate)),
          or(isNull(employees.resignDate), gte(employees.resignDate, startDate)),
        ),
      )
      .orderBy(asc(employees.code));

    if (employeeRows.length === 0) {
      throw ApiError.badRequest("Tidak ada karyawan aktif pada periode ini.");
    }

    const employeeIds = employeeRows.map((employee) => employee.id);

    const attendanceRows = await tx
      .select({
        employeeId: attendanceRecords.employeeId,
        status: attendanceRecords.status,
        overtimeHours: attendanceRecords.overtimeHours,
      })
      .from(attendanceRecords)
      .where(
        and(
          inArray(attendanceRecords.employeeId, employeeIds),
          gte(attendanceRecords.attendanceDate, startDate),
          lte(attendanceRecords.attendanceDate, endDate),
        ),
      );

    const attendanceByEmployee = new Map<
      string,
      { absentDays: number; overtimeHours: number }
    >();
    for (const row of attendanceRows) {
      const current = attendanceByEmployee.get(row.employeeId) ?? {
        absentDays: 0,
        overtimeHours: 0,
      };
      if (row.status === "ABSENT") current.absentDays += 1;
      current.overtimeHours += Number(row.overtimeHours);
      attendanceByEmployee.set(row.employeeId, current);
    }

    const leaveRows = await tx
      .select({
        employeeId: leaveRequests.employeeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        isPaid: leaveTypes.isPaid,
        leaveTypeName: leaveTypes.name,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(
        and(
          inArray(leaveRequests.employeeId, employeeIds),
          eq(leaveRequests.status, "APPROVED"),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate),
        ),
      );

    const unpaidLeaveByEmployee = new Map<string, number>();
    const leaveSummaryByEmployee = new Map<string, { type: string; days: number }[]>();
    for (const row of leaveRows) {
      const days = overlapWeekdays(row.startDate, row.endDate, startDate, endDate);
      if (days <= 0) continue;
      const summary = leaveSummaryByEmployee.get(row.employeeId) ?? [];
      summary.push({ type: row.leaveTypeName, days });
      leaveSummaryByEmployee.set(row.employeeId, summary);
      if (!row.isPaid) {
        unpaidLeaveByEmployee.set(
          row.employeeId,
          (unpaidLeaveByEmployee.get(row.employeeId) ?? 0) + days,
        );
      }
    }

    const lines = employeeRows.map((employee) => {
      const attendance = attendanceByEmployee.get(employee.id) ?? {
        absentDays: 0,
        overtimeHours: 0,
      };
      const unpaidDays = attendance.absentDays + (unpaidLeaveByEmployee.get(employee.id) ?? 0);
      const computed = computePayrollLine({
        basicSalary: Number(employee.basicSalary),
        fixedAllowance: Number(employee.fixedAllowance),
        overtimeHours: attendance.overtimeHours,
        unpaidDays,
        taxStatus: (employee.taxStatus as TaxStatus) ?? "TK/0",
      });
      return {
        employee,
        attendance,
        unpaidDays,
        leaveSummary: leaveSummaryByEmployee.get(employee.id) ?? [],
        computed,
      };
    });

    const totalGross = roundMoney(lines.reduce((sum, line) => sum + line.computed.gross, 0));
    const totalDeductions = roundMoney(
      lines.reduce((sum, line) => sum + line.computed.totalDeductions, 0),
    );
    const totalNet = roundMoney(lines.reduce((sum, line) => sum + line.computed.net, 0));
    const totalEmployerContributions = roundMoney(
      lines.reduce((sum, line) => sum + line.computed.totalEmployerContributions, 0),
    );

    const number = await nextDocumentNumber(tx, "PAY", {
      period: input.period.replace("-", ""),
    });
    const [run] = await tx
      .insert(payrollRuns)
      .values({
        number,
        period: input.period,
        startDate,
        endDate,
        status: "DRAFT",
        totalGross: totalGross.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        totalNet: totalNet.toFixed(2),
        totalEmployerContributions: totalEmployerContributions.toFixed(2),
        createdBy: actorUserId,
      })
      .returning();
    if (!run) throw ApiError.badRequest("Gagal membuat payroll.");

    await tx.insert(payslips).values(
      lines.map(({ employee, attendance, unpaidDays, leaveSummary, computed }) => ({
        payrollRunId: run.id,
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: employee.name,
        departmentName: employee.departmentName,
        jobTitle: employee.jobTitle,
        bankName: employee.bankName,
        bankAccountNumber: employee.bankAccountNumber,
        basicSalary: computed.basicSalary.toFixed(2),
        fixedAllowance: computed.fixedAllowance.toFixed(2),
        overtimePay: computed.overtimePay.toFixed(2),
        gross: computed.gross.toFixed(2),
        unpaidLeaveDeduction: computed.unpaidLeaveDeduction.toFixed(2),
        bpjsKesehatanEmployee: computed.bpjsKesehatanEmployee.toFixed(2),
        bpjsJhtEmployee: computed.bpjsJhtEmployee.toFixed(2),
        bpjsJpEmployee: computed.bpjsJpEmployee.toFixed(2),
        pph21: computed.pph21.toFixed(2),
        otherDeductions: computed.otherDeductions.toFixed(2),
        totalDeductions: computed.totalDeductions.toFixed(2),
        net: computed.net.toFixed(2),
        employerBpjsKesehatan: computed.employerBpjsKesehatan.toFixed(2),
        employerBpjsJht: computed.employerBpjsJht.toFixed(2),
        employerBpjsJp: computed.employerBpjsJp.toFixed(2),
        employerJkk: computed.employerJkk.toFixed(2),
        employerJkm: computed.employerJkm.toFixed(2),
        totalEmployerContributions: computed.totalEmployerContributions.toFixed(2),
        details: {
          ...computed.details,
          attendance,
          unpaidDays,
          leaveSummary,
        },
      })),
    );

    await recordAudit(tx, {
      actorUserId,
      action: "payroll.create",
      entityType: "payroll-run",
      entityId: run.id,
      details: {
        number: run.number,
        period: run.period,
        employeeCount: lines.length,
        totalNet,
      },
    });
    return run;
  });
}

export async function approvePayrollRun(
  payrollRunId: string,
  actorUserId: string,
): Promise<PayrollRun> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, payrollRunId))
      .limit(1)
      .for("update");
    if (!run) throw ApiError.notFound("Payroll tidak ditemukan.");
    if (run.status !== "DRAFT") {
      throw ApiError.conflict("Hanya payroll berstatus draf yang dapat disetujui.");
    }

    const rows = await tx
      .select()
      .from(payslips)
      .where(eq(payslips.payrollRunId, run.id))
      .orderBy(asc(payslips.employeeCode));
    if (rows.length === 0) throw ApiError.conflict("Payroll tidak memiliki slip gaji.");

    const journal = await postPayrollToAccounting(tx, run, rows, actorUserId);
    const [updated] = await tx
      .update(payrollRuns)
      .set({
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: actorUserId,
        journalEntryId: journal.id,
      })
      .where(eq(payrollRuns.id, run.id))
      .returning();
    if (!updated) throw ApiError.notFound("Payroll tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "payroll.approve",
      entityType: "payroll-run",
      entityId: run.id,
      details: { number: run.number, journalNumber: journal.number, totalNet: run.totalNet },
    });
    return updated;
  });
}

export async function payPayrollRun(
  payrollRunId: string,
  input: PayPayrollRunInput,
  actorUserId: string,
): Promise<PayrollRun> {
  const detail = await getPayrollRunDetail(payrollRunId);
  if (detail.run.status !== "APPROVED") {
    throw ApiError.conflict("Payroll harus disetujui sebelum dibayar.");
  }
  await createPayment(
    {
      type: "PAYMENT",
      date: input.date,
      amount: Number(detail.run.totalNet),
      accountId: input.accountId,
      referenceType: "PAYROLL_RUN",
      referenceId: detail.run.id,
      notes: `Pembayaran payroll ${detail.run.number}`,
    },
    actorUserId,
  );
  const updated = await getPayrollRunDetail(payrollRunId);
  return updated.run;
}

export async function cancelPayrollRun(
  payrollRunId: string,
  reason: string,
  actorUserId: string,
): Promise<PayrollRun> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, payrollRunId))
      .limit(1)
      .for("update");
    if (!run) throw ApiError.notFound("Payroll tidak ditemukan.");
    if (run.status !== "DRAFT") {
      throw ApiError.conflict("Hanya payroll draf yang dapat dibatalkan.");
    }
    const [updated] = await tx
      .update(payrollRuns)
      .set({ status: "CANCELLED", cancelReason: reason })
      .where(eq(payrollRuns.id, run.id))
      .returning();
    if (!updated) throw ApiError.notFound("Payroll tidak ditemukan.");
    await recordAudit(tx, {
      actorUserId,
      action: "payroll.cancel",
      entityType: "payroll-run",
      entityId: run.id,
      details: { number: run.number, reason },
    });
    return updated;
  });
}
