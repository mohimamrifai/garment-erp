import { z } from "zod";

export const listMaterialsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;

export const materialFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  unitId: z.uuid("Pilih satuan."),
  minimumStock: z
    .number({ error: "Stok minimum harus berupa angka." })
    .min(0, "Stok minimum tidak boleh negatif.")
    .max(999_999_999_999, "Stok minimum terlalu besar."),
  notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});
export type MaterialFormInput = z.infer<typeof materialFormSchema>;

export const updateMaterialSchema = materialFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
