import { and, eq, inArray, type SQL } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import type { DbTransaction } from "@/lib/db";
import {
  inventoryBalances,
  inventoryTransactions,
  type InventoryBalance,
  type InventoryTransaction,
  warehouseLocations,
} from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/utils/db-errors";
import { nextDocumentNumber } from "@/lib/utils/documents";

/**
 * INVENTORY ENGINE (F3 task 3.1) — satu-satunya jalur perubahan stok.
 *
 * Aturan yang dijamin:
 * 1. `postMovement()` WAJIB dipanggil di dalam satu transaksi DB bersama
 *    dokumen sumbernya (PO/receipt/SPK). Semua perubahan bersifat atomik.
 * 2. Baris saldo dikunci (`SELECT ... FOR UPDATE`) dengan urutan lokasi yang
 *    deterministik → aman terhadap request bersamaan & bebas deadlock.
 * 3. Saldo tidak boleh negatif dan stok yang direservasi tidak boleh dipakai
 *    transaksi lain (`quantity_reserved <= quantity_on_hand` dijaga di sini
 *    dan oleh CHECK constraint di database).
 * 4. Mutasi bersifat immutable + punya nomor urut `TRX-YYYYMM-####`.
 * 5. `idempotency_key` UNIQUE → request posting berulang tidak menggandakan
 *    mutasi (mengembalikan transaksi yang sudah ada, `applied: false`).
 */

export type InventoryItemType = "MATERIAL" | "FINISHED_GOOD";
export type InventoryTransactionType =
  (typeof inventoryTransactions.$inferSelect)["transactionType"];

/** Referensi item dengan tipe yang saling mengecualikan (discriminated union). */
export type InventoryItemRef =
  | { itemType: "MATERIAL"; materialId: string; variantId?: null }
  | { itemType: "FINISHED_GOOD"; variantId: string; materialId?: null };

export type MovementShape = {
  transactionType: InventoryTransactionType;
  quantity: number | string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
};

export type PostMovementInput = InventoryItemRef &
  MovementShape & {
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    /** Kunci anti penggandaan (opsional; dipakai endpoint posting). */
    idempotencyKey?: string | null;
    postedBy?: string | null;
  };

export type PostMovementResult = {
  transaction: InventoryTransaction;
  /** `false` = idempotency key sudah pernah diproses; tidak ada perubahan baru. */
  applied: boolean;
};

/** Pengaruh satu mutasi terhadap satu baris saldo. */
export type BalanceEffect = {
  locationId: string;
  onHandDelta: number;
  reservedDelta: number;
};

const SCALE = 10_000;

function toScaled(value: number): number {
  return Math.round(value * SCALE);
}

/** Bulatkan kuantitas ke 4 desimal (presisi kolom numeric(16,4)). */
export function roundQuantity(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

/** Kuantitas → string desimal untuk kolom numeric (selalu 4 angka di belakang koma). */
export function toQuantityString(value: number): string {
  return (Math.round(value * SCALE) / SCALE).toFixed(4);
}

/**
 * Validasi bentuk mutasi murni (tanpa DB): arah lokasi harus cocok dengan
 * tipe transaksi dan kuantitas > 0. Mengembalikan pesan error atau null.
 */
export function validateMovementShape(input: MovementShape): string | null {
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Kuantitas mutasi harus lebih dari 0.";
  }

  const from = input.fromLocationId ?? null;
  const to = input.toLocationId ?? null;
  const needsFrom = ["ISSUE", "TRANSFER", "ADJUSTMENT_OUT", "RESERVE", "UNRESERVE"].includes(
    input.transactionType,
  );
  const needsTo = ["RECEIPT", "TRANSFER", "ADJUSTMENT_IN"].includes(input.transactionType);

  if (needsFrom && !from) return "Lokasi asal wajib diisi untuk mutasi ini.";
  if (needsTo && !to) return "Lokasi tujuan wajib diisi untuk mutasi ini.";
  if (!needsFrom && from) return "Lokasi asal tidak boleh diisi untuk mutasi ini.";
  if (!needsTo && to) return "Lokasi tujuan tidak boleh diisi untuk mutasi ini.";
  if (input.transactionType === "TRANSFER" && from === to) {
    return "Lokasi asal dan tujuan transfer harus berbeda.";
  }
  return null;
}

/** Efek saldo dari mutasi yang sudah tervalidasi bentuknya. */
export function movementEffects(input: MovementShape, quantity: number): BalanceEffect[] {
  switch (input.transactionType) {
    case "RECEIPT":
      return [{ locationId: input.toLocationId!, onHandDelta: quantity, reservedDelta: 0 }];
    case "ISSUE":
      return [{ locationId: input.fromLocationId!, onHandDelta: -quantity, reservedDelta: 0 }];
    case "TRANSFER":
      return [
        { locationId: input.fromLocationId!, onHandDelta: -quantity, reservedDelta: 0 },
        { locationId: input.toLocationId!, onHandDelta: quantity, reservedDelta: 0 },
      ];
    case "ADJUSTMENT_IN":
      return [{ locationId: input.toLocationId!, onHandDelta: quantity, reservedDelta: 0 }];
    case "ADJUSTMENT_OUT":
      return [{ locationId: input.fromLocationId!, onHandDelta: -quantity, reservedDelta: 0 }];
    case "RESERVE":
      return [{ locationId: input.fromLocationId!, onHandDelta: 0, reservedDelta: quantity }];
    case "UNRESERVE":
      return [{ locationId: input.fromLocationId!, onHandDelta: 0, reservedDelta: -quantity }];
  }
}

export type BalanceViolation =
  | { kind: "on_hand_negative"; available: number; requested: number }
  | { kind: "reserved_exceeds_available"; available: number; requested: number }
  | { kind: "reserved_negative"; reserved: number; requested: number };

/**
 * Validasi efek mutasi terhadap saldo terkunci (aritmetika integer 1e-4 agar
 * bebas galat floating point). Radius aturan:
 * - Mutasi keluar hanya boleh mengambil stok yang tidak sedang direservasi.
 * - Reservasi tidak boleh melebihi stok tersedia.
 * - Pelepasan reservasi tidak boleh melebihi jumlah yang direservasi.
 */
export function checkEffectAgainstBalance(
  effect: BalanceEffect,
  balance: { onHand: number; reserved: number },
): BalanceViolation | null {
  const onHand = toScaled(balance.onHand);
  const reserved = toScaled(balance.reserved);
  const onHandDelta = toScaled(effect.onHandDelta);
  const reservedDelta = toScaled(effect.reservedDelta);

  const nextOnHand = onHand + onHandDelta;
  const nextReserved = reserved + reservedDelta;

  if (nextOnHand < 0) {
    return { kind: "on_hand_negative", available: (onHand - reserved) / SCALE, requested: -effect.onHandDelta };
  }
  if (nextReserved > nextOnHand) {
    return {
      kind: "reserved_exceeds_available",
      available: (onHand - reserved) / SCALE,
      requested: Math.abs(onHandDelta) / SCALE || Math.abs(effect.reservedDelta),
    };
  }
  if (nextReserved < 0) {
    return { kind: "reserved_negative", reserved: reserved / SCALE, requested: -effect.reservedDelta };
  }
  return null;
}

function violationMessage(violation: BalanceViolation): string {
  switch (violation.kind) {
    case "on_hand_negative":
      return `Saldo stok tidak cukup (tersedia ${violation.available}, diminta ${violation.requested}).`;
    case "reserved_exceeds_available":
      return `Stok tersedia di luar reservasi tidak cukup (tersedia ${violation.available}, diminta ${violation.requested}).`;
    case "reserved_negative":
      return `Jumlah reservasi yang dilepas melebihi reservasi berjalan (reservasi ${violation.reserved}, diminta ${violation.requested}).`;
  }
}

async function findTransactionByKey(
  tx: DbTransaction,
  idempotencyKey: string,
): Promise<InventoryTransaction | undefined> {
  const [row] = await tx
    .select()
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.idempotencyKey, idempotencyKey))
    .limit(1);
  return row;
}

/**
 * Posting satu mutasi stok. WAJIB dipanggil di dalam transaksi DB.
 *
 * Melempar `ApiError` 400 untuk bentuk mutasi tidak valid dan 409 untuk saldo
 * tidak cukup. Bila `idempotencyKey` sudah pernah diproses, mengembalikan
 * transaksi yang ada tanpa mengubah saldo.
 */
export async function postMovement(
  tx: DbTransaction,
  input: PostMovementInput,
): Promise<PostMovementResult> {
  const shapeError = validateMovementShape(input);
  if (shapeError) throw ApiError.badRequest(shapeError);

  const quantity = roundQuantity(Number(input.quantity));
  if (quantity > 1_000_000_000_000) {
    throw ApiError.badRequest("Kuantitas mutasi terlalu besar.");
  }

  const itemColumns =
    input.itemType === "MATERIAL"
      ? { itemType: "MATERIAL" as const, materialId: input.materialId, variantId: null }
      : { itemType: "FINISHED_GOOD" as const, materialId: null, variantId: input.variantId };

  if (input.idempotencyKey) {
    const existing = await findTransactionByKey(tx, input.idempotencyKey);
    if (existing) return { transaction: existing, applied: false };
  }

  // Urutkan efek per lokasi agar urutan penguncian deterministik (anti-deadlock).
  const effects = movementEffects(input, quantity).sort((a, b) =>
    a.locationId < b.locationId ? -1 : a.locationId > b.locationId ? 1 : 0,
  );

  const locationIds = [...new Set(effects.map((effect) => effect.locationId))];
  const locationRows = await tx
    .select({ id: warehouseLocations.id, code: warehouseLocations.code })
    .from(warehouseLocations)
    .where(inArray(warehouseLocations.id, locationIds));
  const locationCodeById = new Map(locationRows.map((row) => [row.id, row.code]));
  if (locationIds.some((id) => !locationCodeById.has(id))) {
    throw ApiError.badRequest("Lokasi gudang tidak ditemukan.");
  }

  const itemCondition: SQL =
    itemColumns.itemType === "MATERIAL"
      ? eq(inventoryBalances.materialId, itemColumns.materialId!)
      : eq(inventoryBalances.variantId, itemColumns.variantId!);

  // 1) Pastikan baris saldo ada (race-safe), 2) kunci dengan FOR UPDATE.
  for (const effect of effects) {
    await tx
      .insert(inventoryBalances)
      .values({
        itemType: itemColumns.itemType,
        materialId: itemColumns.materialId,
        variantId: itemColumns.variantId,
        locationId: effect.locationId,
      })
      .onConflictDoNothing();
  }

  const lockedBalances = new Map<string, InventoryBalance>();
  for (const effect of effects) {
    const [balance] = await tx
      .select()
      .from(inventoryBalances)
      .where(and(itemCondition, eq(inventoryBalances.locationId, effect.locationId)))
      .limit(1)
      .for("update");
    if (!balance) throw ApiError.badRequest("Baris saldo stok tidak dapat dibuat.");
    lockedBalances.set(effect.locationId, balance);
  }

  // Idempotency dicek ulang setelah lock: request kembar yang menunggu lock
  // akan melihat transaksi yang sudah tersimpan dan tidak menggandakan saldo.
  if (input.idempotencyKey) {
    const existing = await findTransactionByKey(tx, input.idempotencyKey);
    if (existing) return { transaction: existing, applied: false };
  }

  for (const effect of effects) {
    const balance = lockedBalances.get(effect.locationId)!;
    const violation = checkEffectAgainstBalance(effect, {
      onHand: Number(balance.quantityOnHand),
      reserved: Number(balance.quantityReserved),
    });
    if (violation) {
      throw ApiError.conflict(
        `${violationMessage(violation)} Lokasi ${locationCodeById.get(effect.locationId)}.`,
      );
    }
  }

  // Catat mutasi lebih dulu (di sini slide UNIQUE idempotency_key), lalu
  // perbarui saldo — bila insert gagal karena duplikasi, saldo tidak tersentuh.
  let transaction: InventoryTransaction | undefined;
  try {
    const number = await nextDocumentNumber(tx, "TRX");
    [transaction] = await tx
      .insert(inventoryTransactions)
      .values({
        number,
        itemType: itemColumns.itemType,
        materialId: itemColumns.materialId,
        variantId: itemColumns.variantId,
        transactionType: input.transactionType,
        quantity: toQuantityString(quantity),
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        postedBy: input.postedBy ?? null,
      })
      .returning();
  } catch (error) {
    if (input.idempotencyKey && isUniqueViolation(error)) {
      const existing = await findTransactionByKey(tx, input.idempotencyKey);
      if (existing) return { transaction: existing, applied: false };
    }
    throw error;
  }
  if (!transaction) throw ApiError.badRequest("Gagal mencatat mutasi stok.");

  for (const effect of effects) {
    const balance = lockedBalances.get(effect.locationId)!;
    await tx
      .update(inventoryBalances)
      .set({
        quantityOnHand: toQuantityString(Number(balance.quantityOnHand) + effect.onHandDelta),
        quantityReserved: toQuantityString(Number(balance.quantityReserved) + effect.reservedDelta),
      })
      .where(eq(inventoryBalances.id, balance.id));
  }

  return { transaction, applied: true };
}
