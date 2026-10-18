import { z } from "zod";

export const listBuyersQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListBuyersQuery = z.infer<typeof listBuyersQuerySchema>;

const optionalEmail = z.union([z.literal(""), z.email("Format email tidak valid.")]).optional();

export const buyerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  contactPerson: z.string().trim().max(100, "Nama kontak maksimal 100 karakter.").optional(),
  phone: z.string().trim().max(30, "Telepon maksimal 30 karakter.").optional(),
  email: optionalEmail,
  address: z.string().trim().max(300, "Alamat maksimal 300 karakter.").optional(),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
});
export type BuyerFormInput = z.infer<typeof buyerFormSchema>;

export const updateBuyerSchema = buyerFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;
