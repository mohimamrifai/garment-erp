import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getTodayDate } from "@/lib/utils/dates";
import { createDepartment } from "@/modules/master/department/service";
import { createEmployee } from "@/modules/master/employee/service";
import {
  approveLeaveRequest,
  createAttendance,
  createLeaveRequest,
  ensureLeaveTypes,
  listLeaveTypes,
} from "@/modules/hr/service";
import {
  approvePayrollRun,
  createPayrollRun,
  getPayrollRunDetail,
  payPayrollRun,
} from "@/modules/payroll/service";
import {
  listCashBankAccounts,
  listPayments,
} from "@/modules/accounting/service";
import { buildReport } from "@/modules/reports/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

function weekdaysInMonth(month: string, count: number): string[] {
  const dates: string[] = [];
  for (let day = 1; day <= 28 && dates.length < count; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(date);
  }
  return dates;
}

async function createFixture() {
  const department = await createDepartment(
    { name: `Payroll Test ${Date.now()}` },
    TEST_ACTOR_ID,
  );
  const employee = await createEmployee(
    {
      name: "Karyawan Uji Payroll",
      departmentId: department.id,
      jobTitle: "Operator",
      employmentType: "PERMANENT",
      taxStatus: "TK/0",
      basicSalary: 6_000_000,
      fixedAllowance: 500_000,
      joinDate: `${getTodayDate().slice(0, 7)}-01`,
      bankName: "BCA",
      bankAccountNumber: "1234567890",
    },
    TEST_ACTOR_ID,
  );
  return employee;
}

describe("payroll (integrasi DB)", () => {
  it("membuat payroll dari absensi dan cuti, lalu menyetujui serta membayar", async () => {
    const employee = await createFixture();
    const month = getTodayDate().slice(0, 7);
    const [absentDate, overtimeDate] = weekdaysInMonth(month, 2);

    await ensureLeaveTypes(db);
    const types = await listLeaveTypes();
    const unpaidType = types.find((type) => type.code === "CUTI_TIDAK_DIBAYAR");
    expect(unpaidType).toBeTruthy();

    await createAttendance(
      {
        employeeId: employee.id,
        attendanceDate: absentDate,
        status: "ABSENT",
        checkIn: "",
        checkOut: "",
        overtimeHours: 0,
        notes: "Tidak hadir tanpa keterangan",
      },
      TEST_ACTOR_ID,
    );
    await createAttendance(
      {
        employeeId: employee.id,
        attendanceDate: overtimeDate,
        status: "PRESENT",
        checkIn: "08:00",
        checkOut: "17:00",
        overtimeHours: 3,
        notes: "Lembur produksi",
      },
      TEST_ACTOR_ID,
    );

    const leave = await createLeaveRequest(
      {
        employeeId: employee.id,
        leaveTypeId: unpaidType!.id,
        startDate: overtimeDate,
        endDate: overtimeDate,
        reason: "Keperluan keluarga",
      },
      TEST_ACTOR_ID,
    );
    await approveLeaveRequest(leave.id, TEST_ACTOR_ID);

    const run = await createPayrollRun({ period: month }, TEST_ACTOR_ID);
    expect(run.status).toBe("DRAFT");
    await expect(createPayrollRun({ period: month }, TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 409,
    });
    expect(Number(run.totalGross)).toBeGreaterThan(0);
    expect(Number(run.totalNet)).toBeGreaterThan(0);

    const detail = await getPayrollRunDetail(run.id);
    expect(detail.payslips).toHaveLength(1);
    const slip = detail.payslips[0];
    expect(Number(slip.overtimePay)).toBeGreaterThan(0);
    expect(Number(slip.unpaidLeaveDeduction)).toBeGreaterThan(0);
    expect(Number(slip.net)).toBeGreaterThan(0);

    const approved = await approvePayrollRun(run.id, TEST_ACTOR_ID);
    expect(approved.status).toBe("APPROVED");
    expect(approved.journalEntryId).toBeTruthy();

    const accounts = await listCashBankAccounts();
    expect(accounts.length).toBeGreaterThan(0);
    const paid = await payPayrollRun(
      run.id,
      { accountId: accounts[0].id, date: getTodayDate() },
      TEST_ACTOR_ID,
    );
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).toBeTruthy();

    const payments = await listPayments({ type: "PAYMENT", page: 1, pageSize: 10 });
    expect(payments.items.some((payment) => payment.referenceType === "PAYROLL_RUN")).toBe(true);

    const report = await buildReport("payroll-summary", { from: `${month}-01`, to: `${month}-28` });
    expect(report.rows.length).toBeGreaterThan(0);
  });

});
