import { z } from "zod";
import { inventoryItemType, inventoryTransactionType } from "@/lib/db/schema";

/** Validasi input modul inventory (F3 task 3.5–3.8). */

const MAX_QUANTITY = 1_000_000_000_000;

const optionalUuid = z.union([z.literal(""), z.uuid("Pilihan tidak valid.")]).default("");

export const listInventoryBalancesQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  warehouse: optionalUuid,
  location: optionalUuid,
  itemType: z.union([z.literal("all"), z.enum(inventoryItemType.enumValues)]).default("all"),
  /** "1" = hanya baris dengan saldo di bawah stok minimum (material). */
  low: z.union([z.literal("1"), z.literal("all")]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListInventoryBalancesQuery = z.infer<typeof listInventoryBalancesQuerySchema>;

export const listInventoryTransactionsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  type: z.union([z.literal("all"), z.enum(inventoryTransactionType.enumValues)]).default("all"),
  itemType: z.union([z.literal("all"), z.enum(inventoryItemType.enumValues)]).default("all"),
  location: optionalUuid,
  from: z.union([z.literal(""), z.iso.date("Tanggal tidak valid.")]).default(""),
  to: z.union([z.literal(""), z.iso.date("Tanggal tidak valid.")]).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListInventoryTransactionsQuery = z.infer<typeof listInventoryTransactionsQuerySchema>;

/** Referensi item untuk transfer/penyesuaian: material atau varian barang jadi. */
const itemRefShape = {
  itemType: z.enum(inventoryItemType.enumValues, { error: "Pilih tipe item." }),
  materialId: z.union([z.literal(""), z.uuid("Material tidak valid.")]).optional(),
  variantId: z.union([z.literal(""), z.uuid("Varian tidak valid.")]).optional(),
};

function refineItemRef(
  data: { itemType?: "MATERIAL" | "FINISHED_GOOD"; materialId?: string; variantId?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.itemType === "MATERIAL" && !data.materialId) {
    ctx.addIssue({ code: "custom", path: ["materialId"], message: "Pilih material." });
  }
  if (data.itemType === "FINISHED_GOOD" && !data.variantId) {
    ctx.addIssue({ code: "custom", path: ["variantId"], message: "Pilih varian produk." });
  }
}

export const transferStockSchema = z
  .object({
    ...itemRefShape,
    fromLocationId: z.uuid("Pilih lokasi asal."),
    toLocationId: z.uuid("Pilih lokasi tujuan."),
    quantity: z
      .number({ error: "Kuantitas harus berupa angka." })
      .gt(0, "Kuantitas harus lebih dari 0.")
      .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
    notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
    /** Kunci anti penggandaan dari klien (opsional). */
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine((data, ctx) => {
    refineItemRef(data, ctx);
    if (data.fromLocationId === data.toLocationId) {
      ctx.addIssue({
        code: "custom",
        path: ["toLocationId"],
        message: "Lokasi tujuan harus berbeda dari lokasi asal.",
      });
    }
  });
export type TransferStockInput = z.infer<typeof transferStockSchema>;

export const adjustStockSchema = z
  .object({
    direction: z.enum(["IN", "OUT"], { error: "Pilih arah penyesuaian." }),
    ...itemRefShape,
    locationId: z.uuid("Pilih lokasi."),
    quantity: z
      .number({ error: "Kuantitas harus berupa angka." })
      .gt(0, "Kuantitas harus lebih dari 0.")
      .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
    reason: z
      .string()
      .trim()
      .min(3, "Alasan minimal 3 karakter.")
      .max(300, "Alasan maksimal 300 karakter."),
    notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
    /** Kunci anti penggandaan dari klien (opsional). */
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine(refineItemRef);
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
