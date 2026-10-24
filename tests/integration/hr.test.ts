import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDepartment } from "@/modules/master/department/service";
import { createEmployee } from "@/modules/master/employee/service";
import {
  approveLeaveRequest,
  createAttendance,
  createLeaveRequest,
  deleteAttendance,
  ensureLeaveTypes,
  listAttendance,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeaveRequest,
  updateAttendance,
} from "@/modules/hr/service";
import { getTodayDate } from "@/lib/utils/dates";
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
    { name: `HR Test ${Date.now()}` },
    TEST_ACTOR_ID,
  );
  const employee = await createEmployee(
    {
      name: "Karyawan Uji HR",
      departmentId: department.id,
      jobTitle: "Staf",
      employmentType: "PERMANENT",
      taxStatus: "TK/0",
      basicSalary: 5_000_000,
      fixedAllowance: 250_000,
      joinDate: `${getTodayDate().slice(0, 7)}-01`,
    },
    TEST_ACTOR_ID,
  );
  return { department, employee };
}

describe("HRIS (integrasi DB)", () => {
  it("mencatat, mengubah, dan menghapus absensi", async () => {
    const { employee } = await createFixture();
    const month = getTodayDate().slice(0, 7);
    const [date] = weekdaysInMonth(month, 1);

    const record = await createAttendance(
      {
        employeeId: employee.id,
        attendanceDate: date,
        status: "PRESENT",
        checkIn: "08:00",
        checkOut: "17:00",
        overtimeHours: 2,
        notes: "Uji absensi",
      },
      TEST_ACTOR_ID,
    );
    expect(record.status).toBe("PRESENT");
    expect(Number(record.overtimeHours)).toBe(2);

    const updated = await updateAttendance(
      record.id,
      { status: "LATE", overtimeHours: 1.5 },
      TEST_ACTOR_ID,
    );
    expect(updated.status).toBe("LATE");
    expect(Number(updated.overtimeHours)).toBe(1.5);

    const list = await listAttendance({ month, status: "LATE", page: 1, pageSize: 20 });
    expect(list.items.some((item) => item.id === record.id)).toBe(true);

    await deleteAttendance(record.id, TEST_ACTOR_ID);
    const afterDelete = await listAttendance({ month, status: "all", page: 1, pageSize: 20 });
    expect(afterDelete.items.some((item) => item.id === record.id)).toBe(false);
  });

  it("mengajukan, menyetujui, dan menolak cuti", async () => {
    const { employee } = await createFixture();
    await ensureLeaveTypes(db);
    const types = await listLeaveTypes();
    const paidType = types.find((type) => type.code === "CUTI_TAHUNAN");
    const unpaidType = types.find((type) => type.code === "CUTI_TIDAK_DIBAYAR");
    expect(paidType).toBeTruthy();
    expect(unpaidType).toBeTruthy();

    const month = getTodayDate().slice(0, 7);
    const [startDate, secondDate] = weekdaysInMonth(month, 2);
    const request = await createLeaveRequest(
      {
        employeeId: employee.id,
        leaveTypeId: paidType!.id,
        startDate,
        endDate: startDate,
        reason: "Uji cuti tahunan",
      },
      TEST_ACTOR_ID,
    );
    expect(request.status).toBe("PENDING");

    const approved = await approveLeaveRequest(request.id, TEST_ACTOR_ID);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedAt).toBeTruthy();

    const rejectedRequest = await createLeaveRequest(
      {
        employeeId: employee.id,
        leaveTypeId: unpaidType!.id,
        startDate: secondDate,
        endDate: secondDate,
        reason: "Uji cuti tidak dibayar",
      },
      TEST_ACTOR_ID,
    );
    const rejected = await rejectLeaveRequest(
      rejectedRequest.id,
      "Stok cuti tidak mencukupi.",
      TEST_ACTOR_ID,
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toContain("Stok cuti");

    const list = await listLeaveRequests({ status: "all", page: 1, pageSize: 10 });
    expect(list.total).toBe(2);
  });
});
