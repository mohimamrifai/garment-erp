import { z } from "zod";
import { materialReceiptStatus, purchaseOrderStatus } from "@/lib/db/schema";

/** Validasi input modul purchasing (F3 task 3.3–3.4). */

const MAX_QUANTITY = 1_000_000_000_000;
const MAX_PRICE = 99_999_999_999;

export const listPurchaseOrdersQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.union([z.literal("all"), z.enum(purchaseOrderStatus.enumValues)]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;

export const purchaseOrderItemFormSchema = z.object({
  materialId: z.uuid("Pilih material."),
  orderedQuantity: z
    .number({ error: "Kuantitas harus berupa angka." })
    .gt(0, "Kuantitas harus lebih dari 0.")
    .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
  unitPrice: z
    .number({ error: "Harga satuan harus berupa angka." })
    .min(0, "Harga satuan tidak boleh negatif.")
    .max(MAX_PRICE, "Harga satuan terlalu besar."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});
export type PurchaseOrderItemFormInput = z.infer<typeof purchaseOrderItemFormSchema>;

export const purchaseOrderFormSchema = z
  .object({
    supplierId: z.uuid("Pilih supplier."),
    orderDate: z.iso.date("Tanggal pesanan wajib diisi."),
    /** Kosong = belum ditentukan. */
    expectedDate: z.union([z.literal(""), z.iso.date("Tanggal tidak valid.")]).optional(),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(purchaseOrderItemFormSchema)
      .min(1, "Tambahkan minimal satu item.")
      .max(200, "Maksimal 200 item per purchase order."),
  })
  .refine(
    (data) => !data.expectedDate || data.expectedDate >= data.orderDate,
    {
      message: "Estimasi kedatangan tidak boleh sebelum tanggal pesanan.",
      path: ["expectedDate"],
    },
  )
  .refine(
    (data) => new Set(data.items.map((item) => item.materialId)).size === data.items.length,
    { message: "Material yang sama tidak boleh dipesan dua kali.", path: ["items"] },
  );
export type PurchaseOrderFormInput = z.infer<typeof purchaseOrderFormSchema>;

export const cancelPurchaseOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

export const listMaterialReceiptsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.union([z.literal("all"), z.enum(materialReceiptStatus.enumValues)]).default("all"),
  /** Filter riwayat per PO (opsional). */
  po: z.union([z.literal(""), z.uuid("Purchase order tidak valid.")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListMaterialReceiptsQuery = z.infer<typeof listMaterialReceiptsQuerySchema>;

export const materialReceiptItemFormSchema = z.object({
  purchaseOrderItemId: z.uuid("Item purchase order tidak valid."),
  receivedQuantity: z
    .number({ error: "Jumlah diterima harus berupa angka." })
    .gt(0, "Jumlah diterima harus lebih dari 0.")
    .max(MAX_QUANTITY, "Jumlah diterima terlalu besar."),
  acceptedQuantity: z
    .number({ error: "Jumlah diterima baik harus berupa angka." })
    .min(0, "Jumlah diterima baik tidak boleh negatif.")
    .max(MAX_QUANTITY, "Jumlah diterima baik terlalu besar."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});
export type MaterialReceiptItemFormInput = z.infer<typeof materialReceiptItemFormSchema>;

export const materialReceiptFormSchema = z
  .object({
    purchaseOrderId: z.uuid("Pilih purchase order."),
    receivedAt: z.iso.date("Tanggal terima wajib diisi."),
    locationId: z.uuid("Pilih lokasi penyimpanan."),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(materialReceiptItemFormSchema)
      .min(1, "Tambahkan minimal satu item.")
      .max(200, "Maksimal 200 item per penerimaan."),
  })
  .refine(
    (data) => data.items.every((item) => item.acceptedQuantity <= item.receivedQuantity),
    {
      message: "Jumlah diterima baik tidak boleh melebihi jumlah diterima.",
      path: ["items"],
    },
  )
  .refine((data) => data.items.some((item) => item.acceptedQuantity > 0), {
    message: "Minimal satu item harus diterima baik (lebih dari 0).",
    path: ["items"],
  })
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.purchaseOrderItemId)).size === data.items.length,
    { message: "Item purchase order yang sama tidak boleh dicatat dua kali.", path: ["items"] },
  );
export type MaterialReceiptFormInput = z.infer<typeof materialReceiptFormSchema>;

export const cancelMaterialReceiptSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});
export type CancelMaterialReceiptInput = z.infer<typeof cancelMaterialReceiptSchema>;
