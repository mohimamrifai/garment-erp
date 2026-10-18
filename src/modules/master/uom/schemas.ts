import { z } from "zod";

export const listUomsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListUomsQuery = z.infer<typeof listUomsQuerySchema>;

export const uomFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter.")
    .max(10, "Kode maksimal 10 karakter.")
    .regex(/^[A-Za-z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung."),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
});
export type UomFormInput = z.infer<typeof uomFormSchema>;

export const updateUomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter.")
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUomInput = z.infer<typeof updateUomSchema>;
