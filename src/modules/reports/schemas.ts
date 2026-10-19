import { z } from "zod";

/** Validasi input laporan & ekspor CSV (F5 task 5.6–5.7). */

export const REPORT_SLUGS = [
  "sales-fulfillment",
  "purchase-receipts",
  "inventory-movements",
  "production-output",
  "production-attainment",
  "qc-defects",
  "fg-shipments",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

export const REPORT_PERIOD_DEFAULT_DAYS = 30;

const optionalDate = z.union([z.literal(""), z.iso.date("Tanggal tidak valid.")]).default("");

export const reportQuerySchema = z.object({
  report: z.enum(REPORT_SLUGS).optional(),
  from: optionalDate,
  to: optionalDate,
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const reportExportQuerySchema = z.object({
  report: z.enum(REPORT_SLUGS, { error: "Pilih laporan yang akan diekspor." }),
  from: optionalDate,
  to: optionalDate,
});
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
