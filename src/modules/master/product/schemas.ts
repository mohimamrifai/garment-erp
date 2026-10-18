import { z } from "zod";

export const listProductsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  description: z.string().trim().max(300, "Deskripsi maksimal 300 karakter.").optional(),
});
export type ProductFormInput = z.infer<typeof productFormSchema>;

export const updateProductSchema = productFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const variantFormSchema = z.object({
  size: z
    .string()
    .trim()
    .min(1, "Ukuran wajib diisi.")
    .max(20, "Ukuran maksimal 20 karakter."),
  color: z
    .string()
    .trim()
    .min(1, "Warna wajib diisi.")
    .max(40, "Warna maksimal 40 karakter."),
});
export type VariantFormInput = z.infer<typeof variantFormSchema>;

export const updateVariantSchema = variantFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
