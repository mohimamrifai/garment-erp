import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { inventoryCosts } from "@/lib/db/schema";

/** Item persediaan yang memiliki nilai biaya rata-rata tertimbang. */
export type CostItem = {
  itemType: "MATERIAL" | "FINISHED_GOOD";
  materialId?: string | null;
  variantId?: string | null;
};

function itemWhere(item: CostItem) {
  if (item.itemType === "MATERIAL") {
    if (!item.materialId) throw new Error("materialId wajib untuk biaya material.");
    return and(eq(inventoryCosts.materialId, item.materialId), isNull(inventoryCosts.variantId));
  }
  if (!item.variantId) throw new Error("variantId wajib untuk biaya barang jadi.");
  return and(eq(inventoryCosts.variantId, item.variantId), isNull(inventoryCosts.materialId));
}

async function lockCostRow(tx: DbTransaction, item: CostItem) {
  await tx
    .insert(inventoryCosts)
    .values({
      itemType: item.itemType,
      materialId: item.materialId ?? null,
      variantId: item.variantId ?? null,
      quantityOnHand: "0",
      totalValue: "0",
      averageCost: "0",
    })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(inventoryCosts)
    .where(itemWhere(item))
    .limit(1)
    .for("update");
  if (!row) throw new Error("Baris biaya persediaan tidak dapat dibuat.");
  return row;
}

export async function getAverageCost(tx: DbTransaction, item: CostItem): Promise<number> {
  const row = await lockCostRow(tx, item);
  return Number(row.averageCost);
}

/**
 * Tambah kuantitas & nilai persediaan. `unitCost` adalah harga perolehan
 * (neto PPN). Rata-rata baru dihitung dari nilai total / kuantitas total.
 */
export async function receiveInventoryCost(
  tx: DbTransaction,
  item: CostItem,
  quantity: number,
  unitCost: number,
): Promise<{ unitCost: number; averageCost: number; totalValue: number }> {
  if (quantity <= 0) return { unitCost, averageCost: 0, totalValue: 0 };
  const row = await lockCostRow(tx, item);
  const oldQty = Number(row.quantityOnHand);
  const oldValue = Number(row.totalValue);
  const incomingValue = Math.round(quantity * unitCost * 100) / 100;
  const newQty = Math.round((oldQty + quantity) * 10_000) / 10_000;
  const newValue = Math.round((oldValue + incomingValue) * 100) / 100;
  const averageCost = newQty > 0 ? Math.round((newValue / newQty) * 10_000) / 10_000 : 0;

  await tx
    .update(inventoryCosts)
    .set({
      quantityOnHand: newQty.toFixed(4),
      totalValue: newValue.toFixed(2),
      averageCost: averageCost.toFixed(4),
    })
    .where(eq(inventoryCosts.id, row.id));

  return { unitCost, averageCost, totalValue: incomingValue };
}

/**
 * Keluarkan kuantitas persediaan dengan biaya rata-rata berjalan. Mengembalikan
 * biaya per unit yang dipakai untuk COGS / WIP.
 */
export async function issueInventoryCost(
  tx: DbTransaction,
  item: CostItem,
  quantity: number,
): Promise<{ unitCost: number; totalCost: number; averageCost: number }> {
  if (quantity <= 0) return { unitCost: 0, totalCost: 0, averageCost: 0 };
  const row = await lockCostRow(tx, item);
  const oldQty = Number(row.quantityOnHand);
  const oldValue = Number(row.totalValue);
  const unitCost = Number(row.averageCost);
  const totalCost = Math.round(quantity * unitCost * 100) / 100;
  const newQty = Math.max(0, Math.round((oldQty - quantity) * 10_000) / 10_000);
  const newValue = Math.max(0, Math.round((oldValue - totalCost) * 100) / 100);
  const averageCost = newQty > 0 ? Math.round((newValue / newQty) * 10_000) / 10_000 : 0;

  await tx
    .update(inventoryCosts)
    .set({
      quantityOnHand: newQty.toFixed(4),
      totalValue: newValue.toFixed(2),
      averageCost: averageCost.toFixed(4),
    })
    .where(eq(inventoryCosts.id, row.id));

  return { unitCost, totalCost, averageCost };
}

/** Nilai persediaan saat ini (untuk laporan / rekonsiliasi). */
export async function getInventoryValueSummary(tx: DbTransaction): Promise<{
  materialValue: number;
  finishedGoodsValue: number;
}> {
  const [row] = await tx
    .select({
      materialValue: sql<string>`coalesce(sum(case when ${inventoryCosts.itemType} = 'MATERIAL' then ${inventoryCosts.totalValue} else 0 end), 0)`,
      finishedGoodsValue: sql<string>`coalesce(sum(case when ${inventoryCosts.itemType} = 'FINISHED_GOOD' then ${inventoryCosts.totalValue} else 0 end), 0)`,
    })
    .from(inventoryCosts);
  return {
    materialValue: Number(row?.materialValue ?? 0),
    finishedGoodsValue: Number(row?.finishedGoodsValue ?? 0),
  };
}
