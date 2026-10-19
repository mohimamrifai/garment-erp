import { z } from "zod";
import { shipmentStatus } from "@/lib/db/schema";

/** Validasi input modul pengiriman (F5 task 5.3–5.4). */

const MAX_QUANTITY = 1_000_000;

export const listShipmentsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.union([z.literal("all"), z.enum(shipmentStatus.enumValues)]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;

const shipmentItemShape = {
  salesOrderItemId: z.uuid("Item pesanan tidak valid."),
  quantity: z
    .number({ error: "Kuantitas pengiriman harus berupa angka." })
    .int("Kuantitas pengiriman harus bilangan bulat.")
    .min(1, "Kuantitas pengiriman minimal 1.")
    .max(MAX_QUANTITY, "Kuantitas pengiriman terlalu besar."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
};

/** Payload API pembuatan pengiriman (item hanya yang dikirim, qty > 0). */
export const createShipmentSchema = z
  .object({
    salesOrderId: z.uuid("Pilih sales order."),
    locationId: z.uuid("Pilih lokasi barang jadi."),
    shippedAt: z.iso.date("Tanggal pengiriman wajib diisi."),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(z.object(shipmentItemShape))
      .min(1, "Tambahkan minimal satu item pengiriman.")
      .max(100, "Maksimal 100 item per pengiriman."),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const item of data.items) {
      if (seen.has(item.salesOrderItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "Ada item pesanan yang tercantum lebih dari sekali.",
        });
        break;
      }
      seen.add(item.salesOrderItemId);
    }
  });
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const cancelShipmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});
export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;

/** Alokasi (reservasi) barang jadi untuk sebuah item pesanan. */
export const createAllocationSchema = z.object({
  salesOrderItemId: z.uuid("Item pesanan tidak valid."),
  locationId: z.uuid("Pilih lokasi barang jadi."),
  quantity: z
    .number({ error: "Kuantitas alokasi harus berupa angka." })
    .int("Kuantitas alokasi harus bilangan bulat.")
    .min(1, "Kuantitas alokasi minimal 1.")
    .max(MAX_QUANTITY, "Kuantitas alokasi terlalu besar."),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
});
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;

export const releaseAllocationSchema = z.object({
  salesOrderItemId: z.uuid("Item pesanan tidak valid."),
  locationId: z.uuid("Lokasi alokasi tidak valid."),
  quantity: z
    .number({ error: "Kuantitas pelepasan harus berupa angka." })
    .int("Kuantitas pelepasan harus bilangan bulat.")
    .min(1, "Kuantitas pelepasan minimal 1.")
    .max(MAX_QUANTITY, "Kuantitas pelepasan terlalu besar."),
  reason: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});
export type ReleaseAllocationInput = z.infer<typeof releaseAllocationSchema>;

/**
 * Input form pengiriman (dialog/halaman). Kuantitas boleh 0 = item tidak
 * dikirim kali ini; klien memfilter > 0 sebelum mengirim ke API.
 */
export const shipmentFormSchema = z
  .object({
    salesOrderId: z.uuid("Pilih sales order."),
    locationId: z.uuid("Pilih lokasi barang jadi."),
    shippedAt: z.iso.date("Tanggal pengiriman wajib diisi."),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
    items: z
      .array(
        z.object({
          salesOrderItemId: z.uuid(),
          quantity: z
            .number({ error: "Kuantitas harus berupa angka." })
            .int("Kuantitas pengiriman harus bilangan bulat.")
            .min(0, "Kuantitas tidak boleh negatif.")
            .max(MAX_QUANTITY, "Kuantitas terlalu besar."),
        }),
      )
      .min(1, "Pesanan ini tidak memiliki item."),
  })
  .refine((data) => data.items.some((item) => item.quantity > 0), {
    message: "Isi minimal satu kuantitas pengiriman.",
    path: ["items"],
  });
export type ShipmentFormInput = z.infer<typeof shipmentFormSchema>;
