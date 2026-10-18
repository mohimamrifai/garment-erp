import { z } from "zod";

export const listBomsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "draft"]).default("all"),
  variant: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListBomsQuery = z.infer<typeof listBomsQuerySchema>;

export const bomCreateSchema = z.object({
  variantId: z.uuid("Pilih varian."),
  notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});
export type BomCreateInput = z.infer<typeof bomCreateSchema>;

export const bomItemFormSchema = z.object({
  materialId: z.uuid("Pilih material."),
  quantityPerUnit: z
    .number({ error: "Kebutuhan per unit harus berupa angka." })
    .positive("Kebutuhan per unit harus lebih dari 0.")
    .max(999_999_999, "Kebutuhan per unit terlalu besar."),
  scrapAllowance: z
    .number({ error: "Cadangan harus berupa angka." })
    .min(0, "Cadangan tidak boleh negatif.")
    .max(999_999_999, "Cadangan terlalu besar."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});
export type BomItemFormInput = z.infer<typeof bomItemFormSchema>;
