import { z } from "zod";

/** Validasi input modul barang jadi (F5 task 5.1–5.2). */

const optionalUuid = z.union([z.literal(""), z.uuid("Pilihan tidak valid.")]).default("");

export const listFinishedGoodsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  warehouse: optionalUuid,
  location: optionalUuid,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListFinishedGoodsQuery = z.infer<typeof listFinishedGoodsQuerySchema>;
