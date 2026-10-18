import { z } from "zod";
import { salesOrderStatus } from "@/lib/db/schema";

export const listSalesOrdersQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.union([z.literal("all"), z.enum(salesOrderStatus.enumValues)]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersQuerySchema>;

export const salesOrderItemFormSchema = z.object({
  variantId: z.uuid("Pilih varian."),
  quantity: z
    .number({ error: "Kuantitas harus berupa angka." })
    .int("Kuantitas harus bilangan bulat.")
    .min(1, "Kuantitas minimal 1.")
    .max(1_000_000, "Kuantitas terlalu besar."),
  unitPrice: z
    .number({ error: "Harga satuan harus berupa angka." })
    .min(0, "Harga satuan tidak boleh negatif.")
    .max(99_999_999_999, "Harga satuan terlalu besar."),
  /** Kosong = ikut tenggat pesanan. */
  dueDate: z.union([z.literal(""), z.iso.date("Tanggal tidak valid.")]).optional(),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});
export type SalesOrderItemFormInput = z.infer<typeof salesOrderItemFormSchema>;

export const salesOrderFormSchema = z
  .object({
    buyerId: z.uuid("Pilih buyer."),
    orderDate: z.iso.date("Tanggal pesanan wajib diisi."),
    dueDate: z.iso.date("Tenggat wajib diisi."),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(salesOrderItemFormSchema)
      .min(1, "Tambahkan minimal satu item.")
      .max(100, "Maksimal 100 item per pesanan."),
  })
  .refine((data) => data.dueDate >= data.orderDate, {
    message: "Tenggat tidak boleh sebelum tanggal pesanan.",
    path: ["dueDate"],
  })
  .refine(
    (data) => new Set(data.items.map((item) => item.variantId)).size === data.items.length,
    { message: "Varian yang sama tidak boleh dipesan dua kali.", path: ["items"] },
  );
export type SalesOrderFormInput = z.infer<typeof salesOrderFormSchema>;

export const cancelSalesOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});
export type CancelSalesOrderInput = z.infer<typeof cancelSalesOrderSchema>;
