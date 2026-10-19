import { z } from "zod";

/** Validasi input modul audit log (PRD M11) — hanya baca. */

export const listAuditLogsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  /** Filter aksi persis, mis. `buyer.create`. */
  action: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
