import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { employees } from "./master-data";

/**
 * HRIS (F7): absensi, cuti, dan administrasi kepegawaian.
 *
 * Data induk karyawan tetap berada di `employees`; tabel di sini hanya
 * menambahkan riwayat operasional. Semua status memakai teks + CHECK agar
 * mudah diperluas tanpa migrasi enum yang mahal.
 */

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    attendanceDate: date("attendance_date").notNull(),
    /** PRESENT | LATE | ABSENT | LEAVE | SICK | HOLIDAY */
    status: text("status").notNull().default("PRESENT"),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("attendance_records_employee_idx").on(t.employeeId),
    index("attendance_records_date_idx").on(t.attendanceDate),
    index("attendance_records_status_idx").on(t.status),
    unique("attendance_records_employee_date_uq").on(t.employeeId, t.attendanceDate),
    check(
      "attendance_records_status_chk",
      sql`${t.status} in ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'SICK', 'HOLIDAY')`,
    ),
    check("attendance_records_overtime_chk", sql`${t.overtimeHours} >= 0 and ${t.overtimeHours} <= 24`),
  ],
);

export const leaveTypes = pgTable(
  "leave_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    /** Cuti berbayar tidak memotong gaji; cuti tidak dibayar memotong gaji. */
    isPaid: boolean("is_paid").notNull().default(true),
    maxDaysPerYear: integer("max_days_per_year").notNull().default(12),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("leave_types_max_days_chk", sql`${t.maxDaysPerYear} >= 0`)],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. CUTI-202610-0001. */
    number: text("number").notNull().unique(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    days: integer("days").notNull(),
    reason: text("reason").notNull(),
    /** PENDING | APPROVED | REJECTED | CANCELLED */
    status: text("status").notNull().default("PENDING"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("leave_requests_employee_idx").on(t.employeeId),
    index("leave_requests_status_idx").on(t.status),
    index("leave_requests_dates_idx").on(t.startDate, t.endDate),
    check("leave_requests_dates_chk", sql`${t.endDate} >= ${t.startDate}`),
    check("leave_requests_days_chk", sql`${t.days} > 0`),
    check(
      "leave_requests_status_chk",
      sql`${t.status} in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`,
    ),
  ],
);

/**
 * Satu payroll run per periode aktif. Run yang dibatalkan tidak menghalangi
 * pembuatan run baru untuk periode yang sama (UNIQUE parsial).
 */
export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor dokumen, mis. PAY-202610-0001. */
    number: text("number").notNull().unique(),
    /** Periode gaji YYYY-MM. */
    period: text("period").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    /** DRAFT | APPROVED | PAID | CANCELLED */
    status: text("status").notNull().default("DRAFT"),
    totalGross: numeric("total_gross", { precision: 16, scale: 2 }).notNull().default("0"),
    totalDeductions: numeric("total_deductions", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    totalNet: numeric("total_net", { precision: 16, scale: 2 }).notNull().default("0"),
    totalEmployerContributions: numeric("total_employer_contributions", {
      precision: 16,
      scale: 2,
    })
      .notNull()
      .default("0"),
    journalEntryId: uuid("journal_entry_id"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentAccountId: uuid("payment_account_id"),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("payroll_runs_period_idx").on(t.period),
    index("payroll_runs_status_idx").on(t.status),
    uniqueIndex("payroll_runs_period_active_uq")
      .on(t.period)
      .where(sql`${t.status} <> 'CANCELLED'`),
    check("payroll_runs_period_chk", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("payroll_runs_dates_chk", sql`${t.endDate} >= ${t.startDate}`),
    check(
      "payroll_runs_status_chk",
      sql`${t.status} in ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')`,
    ),
    check("payroll_runs_totals_chk", sql`${t.totalGross} >= 0 and ${t.totalDeductions} >= 0 and ${t.totalNet} >= 0`),
  ],
);

/**
 * Slip gaji per karyawan. Data karyawan di-snapshot agar slip tetap akurat
 * meskipun master karyawan berubah setelah payroll dikunci.
 */
export const payslips = pgTable(
  "payslips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    employeeCode: text("employee_code").notNull(),
    employeeName: text("employee_name").notNull(),
    departmentName: text("department_name").notNull(),
    jobTitle: text("job_title").notNull(),
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    basicSalary: numeric("basic_salary", { precision: 16, scale: 2 }).notNull().default("0"),
    fixedAllowance: numeric("fixed_allowance", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    overtimePay: numeric("overtime_pay", { precision: 16, scale: 2 }).notNull().default("0"),
    gross: numeric("gross", { precision: 16, scale: 2 }).notNull().default("0"),
    unpaidLeaveDeduction: numeric("unpaid_leave_deduction", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    bpjsKesehatanEmployee: numeric("bpjs_kesehatan_employee", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    bpjsJhtEmployee: numeric("bpjs_jht_employee", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    bpjsJpEmployee: numeric("bpjs_jp_employee", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    pph21: numeric("pph21", { precision: 16, scale: 2 }).notNull().default("0"),
    otherDeductions: numeric("other_deductions", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    totalDeductions: numeric("total_deductions", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    net: numeric("net", { precision: 16, scale: 2 }).notNull().default("0"),
    employerBpjsKesehatan: numeric("employer_bpjs_kesehatan", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    employerBpjsJht: numeric("employer_bpjs_jht", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    employerBpjsJp: numeric("employer_bpjs_jp", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    employerJkk: numeric("employer_jkk", { precision: 16, scale: 2 }).notNull().default("0"),
    employerJkm: numeric("employer_jkm", { precision: 16, scale: 2 }).notNull().default("0"),
    totalEmployerContributions: numeric("total_employer_contributions", {
      precision: 16,
      scale: 2,
    })
      .notNull()
      .default("0"),
    /** Rincian komponen untuk slip & audit. */
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payslips_run_idx").on(t.payrollRunId),
    index("payslips_employee_idx").on(t.employeeId),
    unique("payslips_run_employee_uq").on(t.payrollRunId, t.employeeId),
    check("payslips_amounts_chk", sql`${t.gross} >= 0 and ${t.totalDeductions} >= 0 and ${t.net} >= 0`),
  ],
);

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
