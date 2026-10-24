import { z } from "zod";

export const listEmployeesQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  department: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

const optionalEmail = z.union([z.literal(""), z.email("Format email tidak valid.")]).optional();
const optionalDate = z
  .union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  ])
  .optional();

export const EMPLOYMENT_TYPES = ["PERMANENT", "CONTRACT", "DAILY"] as const;
export const TAX_STATUSES = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  PERMANENT: "Karyawan tetap",
  CONTRACT: "Kontrak",
  DAILY: "Harian",
};

const employeeCoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  departmentId: z.uuid("Pilih departemen."),
  jobTitle: z
    .string()
    .trim()
    .min(2, "Jabatan minimal 2 karakter.")
    .max(100, "Jabatan maksimal 100 karakter."),
  phone: z.string().trim().max(30, "Telepon maksimal 30 karakter.").optional(),
  email: optionalEmail,
  joinDate: optionalDate,
  contractStartDate: optionalDate,
  contractEndDate: optionalDate,
  resignDate: optionalDate,
  birthDate: optionalDate,
  address: z.string().trim().max(500, "Alamat maksimal 500 karakter.").optional(),
  bankName: z.string().trim().max(100, "Nama bank maksimal 100 karakter.").optional(),
  bankAccountNumber: z
    .string()
    .trim()
    .max(50, "Nomor rekening maksimal 50 karakter.")
    .optional(),
  bankAccountName: z
    .string()
    .trim()
    .max(150, "Nama pemilik rekening maksimal 150 karakter.")
    .optional(),
  npwp: z.string().trim().max(30, "NPWP maksimal 30 karakter.").optional(),
  bpjsKesehatanNumber: z
    .string()
    .trim()
    .max(30, "Nomor BPJS Kesehatan maksimal 30 karakter.")
    .optional(),
  bpjsKetenagakerjaanNumber: z
    .string()
    .trim()
    .max(30, "Nomor BPJS Ketenagakerjaan maksimal 30 karakter.")
    .optional(),
});

const salarySchema = z
  .number({ error: "Masukkan angka yang valid." })
  .min(0, "Nilai tidak boleh negatif.")
  .max(999_999_999_999, "Nilai terlalu besar.");

export const employeeFormSchema = employeeCoreSchema.extend({
  employmentType: z.enum(EMPLOYMENT_TYPES),
  taxStatus: z.enum(TAX_STATUSES),
  basicSalary: salarySchema,
  fixedAllowance: salarySchema,
});
export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;

export const updateEmployeeSchema = employeeCoreSchema.partial().extend({
  employmentStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  taxStatus: z.enum(TAX_STATUSES).optional(),
  basicSalary: salarySchema.optional(),
  fixedAllowance: salarySchema.optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
