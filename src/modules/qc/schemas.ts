import { z } from "zod";
import { qcResult, productionStageCode } from "@/lib/db/schema";

/** Validasi input modul QC (F4 task 4.6–4.7). */

export const listQcInspectionsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  result: z.union([z.literal("all"), z.enum(qcResult.enumValues)]).default("all"),
  stage: z.union([z.literal("all"), z.enum(productionStageCode.enumValues)]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListQcInspectionsQuery = z.infer<typeof listQcInspectionsQuerySchema>;

export const qcDefectSchema = z.object({
  defectCode: z
    .string()
    .trim()
    .min(1, "Kode cacat wajib diisi.")
    .max(30, "Kode cacat maksimal 30 karakter."),
  defectName: z
    .string()
    .trim()
    .min(2, "Nama cacat minimal 2 karakter.")
    .max(100, "Nama cacat maksimal 100 karakter."),
  quantity: z
    .number({ error: "Kuantitas cacat harus berupa angka." })
    .int("Kuantitas cacat harus bilangan bulat.")
    .min(1, "Kuantitas cacat minimal 1.")
    .max(1_000_000, "Kuantitas cacat terlalu besar."),
  disposition: z
    .union([z.literal(""), z.string().trim().max(100, "Tindakan maksimal 100 karakter.")])
    .optional(),
});
export type QcDefectInput = z.infer<typeof qcDefectSchema>;

export const createQcInspectionSchema = z
  .object({
    productionStageId: z.uuid("Pilih tahap produksi."),
    /** Diisi untuk inspeksi ulang hasil rework. */
    parentInspectionId: z.union([z.literal(""), z.uuid("Inspeksi induk tidak valid.")]).optional(),
    inspectedQuantity: z
      .number({ error: "Kuantitas diperiksa harus berupa angka." })
      .int("Kuantitas diperiksa harus bilangan bulat.")
      .min(1, "Kuantitas diperiksa minimal 1.")
      .max(1_000_000, "Kuantitas diperiksa terlalu besar."),
    passedQuantity: z
      .number({ error: "Kuantitas lolos harus berupa angka." })
      .int("Kuantitas lolos harus bilangan bulat.")
      .min(0, "Kuantitas lolos tidak boleh negatif.")
      .max(1_000_000, "Kuantitas lolos terlalu besar."),
    rejectedQuantity: z
      .number({ error: "Kuantitas cacat harus berupa angka." })
      .int("Kuantitas cacat harus bilangan bulat.")
      .min(0, "Kuantitas cacat tidak boleh negatif.")
      .max(1_000_000, "Kuantitas cacat terlalu besar."),
    result: z.enum(qcResult.enumValues),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    defects: z.array(qcDefectSchema).max(50, "Maksimal 50 detail cacat."),
  })
  .refine((data) => data.passedQuantity + data.rejectedQuantity <= data.inspectedQuantity, {
    message: "Kuantitas lolos + cacat tidak boleh melebihi kuantitas diperiksa.",
    path: ["passedQuantity"],
  })
  .refine((data) => new Set(data.defects.map((defect) => defect.defectCode)).size === data.defects.length, {
    message: "Kode cacat yang sama tidak boleh dicatat dua kali.",
    path: ["defects"],
  })
  .refine(
    (data) =>
      data.defects.reduce((total, defect) => total + defect.quantity, 0) <= data.rejectedQuantity,
    {
      message: "Total kuantitas cacat tidak boleh melebihi kuantitas ditolak.",
      path: ["defects"],
    },
  );
export type CreateQcInspectionInput = z.infer<typeof createQcInspectionSchema>;
