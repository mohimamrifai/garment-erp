import { z } from "zod";

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "LEAVE",
  "SICK",
  "HOLIDAY",
] as const;

export const ATTENDANCE_STATUS_LABELS: Record<(typeof ATTENDANCE_STATUSES)[number], string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  ABSENT: "Tidak hadir",
  LEAVE: "Cuti",
  SICK: "Sakit",
  HOLIDAY: "Libur",
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const LEAVE_STATUS_LABELS: Record<(typeof LEAVE_STATUSES)[number], string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM.")
  .optional()
  .or(z.literal(""));

export const listAttendanceQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bulan harus berformat YYYY-MM.")
    .optional(),
  employeeId: z.uuid().optional(),
  status: z.enum(["all", ...ATTENDANCE_STATUSES]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

export const attendanceFormSchema = z.object({
  employeeId: z.uuid("Pilih karyawan."),
  attendanceDate: isoDate,
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: time,
  checkOut: time,
  overtimeHours: z
    .number({ error: "Masukkan angka yang valid." })
    .min(0, "Jam lembur tidak boleh negatif.")
    .max(24, "Jam lembur maksimal 24."),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
});
export type AttendanceFormInput = z.infer<typeof attendanceFormSchema>;

export const updateAttendanceSchema = attendanceFormSchema.partial();
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export const listLeaveQuerySchema = z.object({
  status: z.enum(["all", ...LEAVE_STATUSES]).default("all"),
  employeeId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListLeaveQuery = z.infer<typeof listLeaveQuerySchema>;

export const leaveRequestFormSchema = z
  .object({
    employeeId: z.uuid("Pilih karyawan."),
    leaveTypeId: z.uuid("Pilih jenis cuti."),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(500),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["endDate"],
  });
export type LeaveRequestFormInput = z.infer<typeof leaveRequestFormSchema>;

export const leaveDecisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
