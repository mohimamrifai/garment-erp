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

export const employeeFormSchema = z.object({
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
});
export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;

export const updateEmployeeSchema = employeeFormSchema.partial().extend({
  employmentStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
