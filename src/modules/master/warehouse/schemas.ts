import { z } from "zod";

export const listWarehousesQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListWarehousesQuery = z.infer<typeof listWarehousesQuerySchema>;

export const warehouseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  address: z.string().trim().max(300, "Alamat maksimal 300 karakter.").optional(),
});
export type WarehouseFormInput = z.infer<typeof warehouseFormSchema>;

export const updateWarehouseSchema = warehouseFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

const locationCode = z
  .string()
  .trim()
  .min(1, "Kode lokasi wajib diisi.")
  .max(20, "Kode lokasi maksimal 20 karakter.")
  .regex(/^[A-Za-z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung.");

export const locationFormSchema = z.object({
  code: locationCode,
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
});
export type LocationFormInput = z.infer<typeof locationFormSchema>;

export const updateLocationSchema = z.object({
  code: locationCode.optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter.")
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
