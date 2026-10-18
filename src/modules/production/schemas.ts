import { z } from "zod";
import { productionOrderStatus, productionStageCode } from "@/lib/db/schema";

/** Validasi input modul produksi (F4 task 4.1–4.5). */

const MAX_QUANTITY = 1_000_000;

export const listProductionOrdersQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.union([z.literal("all"), z.enum(productionOrderStatus.enumValues)]).default("all"),
  /** Filter lini produksi. */
  line: z.union([z.literal(""), z.uuid("Lini tidak valid.")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListProductionOrdersQuery = z.infer<typeof listProductionOrdersQuerySchema>;

export const createProductionOrderSchema = z
  .object({
    salesOrderItemId: z.uuid("Pilih item sales order."),
    plannedQuantity: z
      .number({ error: "Target kuantitas harus berupa angka." })
      .int("Target kuantitas harus bilangan bulat.")
      .min(1, "Target kuantitas minimal 1.")
      .max(MAX_QUANTITY, "Target kuantitas terlalu besar."),
    productionLineId: z.uuid("Pilih lini produksi."),
    plannedStartDate: z.iso.date("Tanggal mulai wajib diisi."),
    plannedEndDate: z.iso.date("Tanggal selesai wajib diisi."),
    /** Diisi supervisor bila tetap dijalankan meski material kurang. */
    shortageReason: z.string().trim().max(300, "Alasan maksimal 300 karakter.").optional(),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
  })
  .refine((data) => data.plannedEndDate >= data.plannedStartDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["plannedEndDate"],
  });
export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;

export const cancelProductionOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});
export type CancelProductionOrderInput = z.infer<typeof cancelProductionOrderSchema>;

export const stageRecordSchema = z
  .object({
    stageCode: z.enum(productionStageCode.enumValues),
    processedQuantity: z
      .number({ error: "Kuantitas diproses harus berupa angka." })
      .int("Kuantitas diproses harus bilangan bulat.")
      .min(1, "Kuantitas diproses minimal 1.")
      .max(MAX_QUANTITY, "Kuantitas diproses terlalu besar."),
    passedQuantity: z
      .number({ error: "Kuantitas lolos harus berupa angka." })
      .int("Kuantitas lolos harus bilangan bulat.")
      .min(0, "Kuantitas lolos tidak boleh negatif.")
      .max(MAX_QUANTITY, "Kuantitas lolos terlalu besar."),
    rejectedQuantity: z
      .number({ error: "Kuantitas cacat harus berupa angka." })
      .int("Kuantitas cacat harus bilangan bulat.")
      .min(0, "Kuantitas cacat tidak boleh negatif.")
      .max(MAX_QUANTITY, "Kuantitas cacat terlalu besar."),
    /** Menandai pemrosesan ulang barang cacat (jatah dari inspeksi REWORK). */
    isRework: z.boolean().default(false),
    notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
  })
  .refine((data) => data.passedQuantity + data.rejectedQuantity === data.processedQuantity, {
    message: "Kuantitas lolos + cacat harus sama dengan kuantitas diproses.",
    path: ["passedQuantity"],
  });
export type StageRecordInput = z.infer<typeof stageRecordSchema>;

export const materialIssueItemSchema = z.object({
  materialId: z.uuid("Pilih material."),
  quantity: z
    .number({ error: "Kuantitas harus berupa angka." })
    .gt(0, "Kuantitas harus lebih dari 0.")
    .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});
export type MaterialIssueItemInput = z.infer<typeof materialIssueItemSchema>;

export const materialIssueSchema = z.object({
  locationId: z.uuid("Pilih lokasi pengambilan."),
  issuedAt: z.iso.date("Tanggal pemakaian wajib diisi."),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
  items: z
    .array(materialIssueItemSchema)
    .min(1, "Tambahkan minimal satu material.")
    .max(100, "Maksimal 100 material per pemakaian."),
});
export type MaterialIssueInput = z.infer<typeof materialIssueSchema>;

/** Ringkasan ketersediaan untuk gate sebelum SPK dibuat (task 4.2). */
export const productionPlanningPreviewQuerySchema = z.object({
  soItem: z.uuid("Item sales order tidak valid."),
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY),
  /** Batas tanggal kebutuhan; penerimaan terjadwal setelah ini tidak dihitung. */
  needBy: z.union([z.literal(""), z.iso.date()]).optional(),
});
export type ProductionPlanningPreviewQuery = z.infer<
  typeof productionPlanningPreviewQuerySchema
>;

/**
 * Input dialog catatan output tahap (kuantitas lolos dihitung =
 * diproses − cacat di klien; batas mesin diuji service).
 */
export const stageRecordDialogSchema = z
  .object({
    processedQuantity: z
      .number({ error: "Kuantitas diproses harus berupa angka." })
      .int("Kuantitas diproses harus bilangan bulat.")
      .min(1, "Kuantitas diproses minimal 1.")
      .max(MAX_QUANTITY, "Kuantitas diproses terlalu besar."),
    rejectedQuantity: z
      .number({ error: "Kuantitas cacat harus berupa angka." })
      .int("Kuantitas cacat harus bilangan bulat.")
      .min(0, "Kuantitas cacat tidak boleh negatif.")
      .max(MAX_QUANTITY, "Kuantitas cacat terlalu besar."),
    isRework: z.boolean(),
    notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
  })
  .refine((data) => data.rejectedQuantity <= data.processedQuantity, {
    message: "Kuantitas cacat tidak boleh melebihi kuantitas diproses.",
    path: ["rejectedQuantity"],
  });
export type StageRecordDialogInput = z.infer<typeof stageRecordDialogSchema>;

/**
 * Input dialog pemakaian material. Semua item BOM dikirim dengan kuantitas
 * (0 = tidak dipakai) agar form sederhana; klien memfilter > 0 saat submit.
 */
export const materialIssueDialogSchema = z
  .object({
    locationId: z.uuid("Pilih lokasi pengambilan."),
    issuedAt: z.iso.date("Tanggal pemakaian wajib diisi."),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(
        z.object({
          materialId: z.uuid(),
          quantity: z
            .number({ error: "Kuantitas harus berupa angka." })
            .min(0, "Kuantitas tidak boleh negatif.")
            .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
          notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
        }),
      )
      .min(1, "Tidak ada material pada BOM SPK ini."),
  })
  .refine((data) => data.items.some((item) => item.quantity > 0), {
    message: "Isi minimal satu kuantitas material.",
    path: ["items"],
  });
export type MaterialIssueDialogInput = z.infer<typeof materialIssueDialogSchema>;
