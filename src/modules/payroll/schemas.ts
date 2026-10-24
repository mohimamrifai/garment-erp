import { z } from "zod";

const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode harus berformat YYYY-MM.");

export const listPayrollRunsQuerySchema = z.object({
  status: z.enum(["all", "DRAFT", "APPROVED", "PAID", "CANCELLED"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListPayrollRunsQuery = z.infer<typeof listPayrollRunsQuerySchema>;

export const createPayrollRunSchema = z.object({
  period: periodSchema,
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const payPayrollRunSchema = z.object({
  accountId: z.uuid("Pilih akun kas/bank."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
});
export type PayPayrollRunInput = z.infer<typeof payPayrollRunSchema>;

export const cancelPayrollRunSchema = z.object({
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(500),
});
export type CancelPayrollRunInput = z.infer<typeof cancelPayrollRunSchema>;
