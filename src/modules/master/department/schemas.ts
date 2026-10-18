import { z } from "zod";

export const listDepartmentsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;

export const departmentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  description: z.string().trim().max(300, "Deskripsi maksimal 300 karakter.").optional(),
});
export type DepartmentFormInput = z.infer<typeof departmentFormSchema>;

export const updateDepartmentSchema = departmentFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
