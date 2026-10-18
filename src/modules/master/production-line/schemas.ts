import { z } from "zod";

export const listLinesQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListLinesQuery = z.infer<typeof listLinesQuerySchema>;

export const lineFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(150, "Nama maksimal 150 karakter."),
  notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});
export type LineFormInput = z.infer<typeof lineFormSchema>;

export const updateLineSchema = lineFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateLineInput = z.infer<typeof updateLineSchema>;
