import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  finishedGoods,
  materialIssues,
  productionOrders,
  purchaseBillItems,
  purchaseBills,
  salesInvoiceItems,
  salesInvoices,
  type FinishedGoodsLot,
  type MaterialIssue,
  type MaterialReceipt,
  type PayrollRun,
  type Payslip,
  type ProductionOrder,
  type PurchaseOrder,
  type SalesOrder,
  type Shipment,
} from "@/lib/db/schema";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { ACCOUNT_KEYS } from "./constants";
import { issueInventoryCost, receiveInventoryCost } from "./costing";
import { getPpnRate, postJournalEntry, roundMoney, toMoneyString } from "./service";

function monthOf(date: string): string {
  return date.slice(0, 7).replace("-", "");
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

/* ------------------------------------------------------------------ */
/* Pembelian: penerimaan material → tagihan & jurnal                   */
/* ------------------------------------------------------------------ */

export type ReceiptAccountingItem = {
  materialId: string;
  materialName: string;
  acceptedQuantity: string | number;
  unitPrice: string | number;
};

/**
 * Posting penerimaan material:
 * - menambah nilai persediaan bahan baku (rata-rata tertimbang),
 * - membuat tagihan pembelian otomatis,
 * - jurnal Dr Persediaan + Dr PPN Masukan / Cr Utang Usaha.
 */
export async function postMaterialReceiptToAccounting(
  tx: DbTransaction,
  receipt: MaterialReceipt,
  order: PurchaseOrder,
  items: ReceiptAccountingItem[],
  actorUserId: string | null,
): Promise<void> {
  const [existing] = await tx
    .select({ id: purchaseBills.id })
    .from(purchaseBills)
    .where(eq(purchaseBills.materialReceiptId, receipt.id))
    .limit(1);
  if (existing) return;

  const valuedItems = items
    .map((item) => ({
      ...item,
      quantity: Number(item.acceptedQuantity),
      price: Number(item.unitPrice),
    }))
    .filter((item) => item.quantity > 0);

  const subtotal = roundMoney(
    valuedItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
  );
  const ppnRate = await getPpnRate(tx);
  const taxAmount = roundMoney(subtotal * ppnRate);
  const total = roundMoney(subtotal + taxAmount);

  for (const item of valuedItems) {
    await receiveInventoryCost(
      tx,
      { itemType: "MATERIAL", materialId: item.materialId },
      item.quantity,
      item.price,
    );
  }

  const number = await nextDocumentNumber(tx, "BILL", { period: monthOf(receipt.receivedAt) });
  const [bill] = await tx
    .insert(purchaseBills)
    .values({
      number,
      materialReceiptId: receipt.id,
      supplierId: order.supplierId,
      billDate: receipt.receivedAt,
      dueDate: addDays(receipt.receivedAt, 30),
      status: total <= 0 ? "PAID" : "UNPAID",
      subtotal: toMoneyString(subtotal),
      taxAmount: toMoneyString(taxAmount),
      total: toMoneyString(total),
      amountPaid: "0",
    })
    .returning();
  if (!bill) throw new Error("Gagal membuat tagihan pembelian.");

  if (valuedItems.length > 0) {
    await tx.insert(purchaseBillItems).values(
      valuedItems.map((item) => ({
        billId: bill.id,
        materialId: item.materialId,
        description: item.materialName,
        quantity: item.quantity.toFixed(4),
        unitPrice: toMoneyString(item.price),
        amount: toMoneyString(item.quantity * item.price),
      })),
    );
  }

  if (total > 0) {
    const journal = await postJournalEntry(tx, {
      date: receipt.receivedAt,
      description: `Penerimaan material ${receipt.number} — ${order.number}`,
      sourceType: "purchase-bill",
      sourceId: bill.id,
      sourceEvent: "post",
      cashFlowCategory: "OPERATING",
      actorUserId,
      lines: [
        {
          accountKey: ACCOUNT_KEYS.INVENTORY_MATERIAL,
          debit: subtotal,
          description: `Persediaan ${receipt.number}`,
        },
        ...(taxAmount > 0
          ? [
              {
                accountKey: ACCOUNT_KEYS.VAT_INPUT,
                debit: taxAmount,
                description: `PPN masukan ${receipt.number}`,
              },
            ]
          : []),
        {
          accountKey: ACCOUNT_KEYS.ACCOUNTS_PAYABLE,
          credit: total,
          description: `Utang ${order.number}`,
        },
      ],
    });
    await tx
      .update(purchaseBills)
      .set({ journalEntryId: journal.id })
      .where(eq(purchaseBills.id, bill.id));
  }
}

/* ------------------------------------------------------------------ */
/* Penjualan: pengiriman → faktur, COGS & jurnal                       */
/* ------------------------------------------------------------------ */

export type ShipmentAccountingItem = {
  salesOrderItemId: string;
  variantId: string;
  variantSku: string;
  quantity: string | number;
  unitPrice: string | number;
};

/**
 * Posting pengiriman:
 * - membuat faktur penjualan otomatis,
 * - mengurangi nilai persediaan barang jadi (COGS),
 * - jurnal Dr Piutang / Cr Penjualan + PPN Keluaran, serta Dr COGS / Cr Persediaan.
 */
export async function postShipmentToAccounting(
  tx: DbTransaction,
  shipment: Shipment,
  order: SalesOrder,
  items: ShipmentAccountingItem[],
  actorUserId: string | null,
): Promise<void> {
  const [existing] = await tx
    .select({ id: salesInvoices.id })
    .from(salesInvoices)
    .where(eq(salesInvoices.shipmentId, shipment.id))
    .limit(1);
  if (existing) return;

  const valuedItems = items
    .map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      price: Number(item.unitPrice),
    }))
    .filter((item) => item.quantity > 0);

  const subtotal = roundMoney(
    valuedItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
  );
  const ppnRate = await getPpnRate(tx);
  const taxAmount = roundMoney(subtotal * ppnRate);
  const total = roundMoney(subtotal + taxAmount);

  let cogs = 0;
  for (const item of valuedItems) {
    const cost = await issueInventoryCost(
      tx,
      { itemType: "FINISHED_GOOD", variantId: item.variantId },
      item.quantity,
    );
    cogs = roundMoney(cogs + cost.totalCost);
  }

  const invoiceDate = shipment.shippedAt;
  const dueDate = maxDate(order.dueDate, invoiceDate);
  const number = await nextDocumentNumber(tx, "INV", { period: monthOf(invoiceDate) });
  const [invoice] = await tx
    .insert(salesInvoices)
    .values({
      number,
      shipmentId: shipment.id,
      buyerId: order.buyerId,
      invoiceDate,
      dueDate,
      status: total <= 0 ? "PAID" : "UNPAID",
      subtotal: toMoneyString(subtotal),
      taxAmount: toMoneyString(taxAmount),
      total: toMoneyString(total),
      amountPaid: "0",
    })
    .returning();
  if (!invoice) throw new Error("Gagal membuat faktur penjualan.");

  if (valuedItems.length > 0) {
    await tx.insert(salesInvoiceItems).values(
      valuedItems.map((item) => ({
        invoiceId: invoice.id,
        salesOrderItemId: item.salesOrderItemId,
        description: item.variantSku,
        quantity: item.quantity.toFixed(4),
        unitPrice: toMoneyString(item.price),
        amount: toMoneyString(item.quantity * item.price),
      })),
    );
  }

  if (total > 0 || cogs > 0) {
    const journal = await postJournalEntry(tx, {
      date: invoiceDate,
      description: `Pengiriman ${shipment.number} — ${order.number}`,
      sourceType: "sales-invoice",
      sourceId: invoice.id,
      sourceEvent: "post",
      cashFlowCategory: "OPERATING",
      actorUserId,
      lines: [
        {
          accountKey: ACCOUNT_KEYS.ACCOUNTS_RECEIVABLE,
          debit: total,
          description: `Piutang ${invoice.number}`,
        },
        {
          accountKey: ACCOUNT_KEYS.SALES_REVENUE,
          credit: subtotal,
          description: `Penjualan ${invoice.number}`,
        },
        ...(taxAmount > 0
          ? [
              {
                accountKey: ACCOUNT_KEYS.VAT_OUTPUT,
                credit: taxAmount,
                description: `PPN keluaran ${invoice.number}`,
              },
            ]
          : []),
        ...(cogs > 0
          ? [
              {
                accountKey: ACCOUNT_KEYS.COST_OF_GOODS_SOLD,
                debit: cogs,
                description: `HPP ${invoice.number}`,
              },
              {
                accountKey: ACCOUNT_KEYS.INVENTORY_FINISHED_GOODS,
                credit: cogs,
                description: `Persediaan barang jadi ${invoice.number}`,
              },
            ]
          : []),
      ],
    });
    await tx
      .update(salesInvoices)
      .set({ journalEntryId: journal.id })
      .where(eq(salesInvoices.id, invoice.id));
  }
}

/* ------------------------------------------------------------------ */
/* Produksi: pemakaian material & barang jadi                          */
/* ------------------------------------------------------------------ */

export type MaterialIssueAccountingItem = {
  materialId: string;
  quantity: string | number;
};

/**
 * Posting pemakaian material:
 * - mengurangi nilai persediaan bahan baku,
 * - menambah WIP dan akumulasi biaya material SPK,
 * - jurnal Dr Barang Dalam Proses / Cr Persediaan Bahan Baku.
 */
export async function postMaterialIssueToAccounting(
  tx: DbTransaction,
  issue: MaterialIssue,
  order: ProductionOrder,
  items: MaterialIssueAccountingItem[],
  actorUserId: string | null,
): Promise<number> {
  let totalCost = 0;
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (quantity <= 0) continue;
    const cost = await issueInventoryCost(
      tx,
      { itemType: "MATERIAL", materialId: item.materialId },
      quantity,
    );
    totalCost = roundMoney(totalCost + cost.totalCost);
  }

  await tx
    .update(materialIssues)
    .set({ totalCost: toMoneyString(totalCost) })
    .where(eq(materialIssues.id, issue.id));

  if (totalCost > 0) {
    await tx
      .update(productionOrders)
      .set({ materialCost: toMoneyString(Number(order.materialCost) + totalCost) })
      .where(eq(productionOrders.id, order.id));

    await postJournalEntry(tx, {
      date: issue.issuedAt,
      description: `Pemakaian material ${issue.number} — ${order.number}`,
      sourceType: "material-issue",
      sourceId: issue.id,
      sourceEvent: "post",
      cashFlowCategory: "OPERATING",
      actorUserId,
      lines: [
        {
          accountKey: ACCOUNT_KEYS.WORK_IN_PROCESS,
          debit: totalCost,
          description: `WIP ${order.number}`,
        },
        {
          accountKey: ACCOUNT_KEYS.INVENTORY_MATERIAL,
          credit: totalCost,
          description: `Persediaan material ${issue.number}`,
        },
      ],
    });
  }

  return totalCost;
}

/**
 * Posting barang jadi:
 * - menghitung harga pokok per unit dari biaya material SPK,
 * - menambah nilai persediaan barang jadi,
 * - jurnal Dr Persediaan Barang Jadi / Cr Barang Dalam Proses.
 */
export async function postFinishedGoodsToAccounting(
  tx: DbTransaction,
  lot: FinishedGoodsLot,
  actorUserId: string | null,
): Promise<void> {
  const [order] = await tx
    .select()
    .from(productionOrders)
    .where(eq(productionOrders.id, lot.productionOrderId))
    .limit(1);
  if (!order) return;

  const quantity = Number(lot.quantity);
  const unitCost =
    order.plannedQuantity > 0 ? Number(order.materialCost) / order.plannedQuantity : 0;
  const totalCost = roundMoney(quantity * unitCost);

  await tx
    .update(finishedGoods)
    .set({ unitCost: unitCost.toFixed(4), totalCost: toMoneyString(totalCost) })
    .where(eq(finishedGoods.id, lot.id));

  await receiveInventoryCost(
    tx,
    { itemType: "FINISHED_GOOD", variantId: lot.variantId },
    quantity,
    unitCost,
  );

  if (totalCost > 0) {
    await postJournalEntry(tx, {
      date: lot.createdAt.toISOString().slice(0, 10),
      description: `Penerimaan barang jadi — ${order.number}`,
      sourceType: "finished-goods-lot",
      sourceId: lot.id,
      sourceEvent: "post",
      cashFlowCategory: "OPERATING",
      actorUserId,
      lines: [
        {
          accountKey: ACCOUNT_KEYS.INVENTORY_FINISHED_GOODS,
          debit: totalCost,
          description: `Persediaan barang jadi ${order.number}`,
        },
        {
          accountKey: ACCOUNT_KEYS.WORK_IN_PROCESS,
          credit: totalCost,
          description: `WIP ${order.number}`,
        },
      ],
    });
  }
}

/* ------------------------------------------------------------------ */
/* Payroll                                                             */
/* ------------------------------------------------------------------ */

/**
 * Jurnal persetujuan payroll:
 * Dr Beban Gaji (gaji bruto - potongan absensi + kontribusi perusahaan)
 * Cr Utang Gaji, Utang PPh 21, Utang BPJS, dan Utang Lain-lain.
 */
export async function postPayrollToAccounting(
  tx: DbTransaction,
  run: PayrollRun,
  rows: Payslip[],
  actorUserId: string | null,
): Promise<{ id: string; number: string }> {
  const totals = rows.reduce(
    (acc, row) => {
      acc.grossEarned += Number(row.gross) - Number(row.unpaidLeaveDeduction);
      acc.net += Number(row.net);
      acc.pph21 += Number(row.pph21);
      acc.employeeBpjs +=
        Number(row.bpjsKesehatanEmployee) +
        Number(row.bpjsJhtEmployee) +
        Number(row.bpjsJpEmployee);
      acc.employerBpjs += Number(row.totalEmployerContributions);
      acc.otherDeductions += Number(row.otherDeductions);
      return acc;
    },
    {
      grossEarned: 0,
      net: 0,
      pph21: 0,
      employeeBpjs: 0,
      employerBpjs: 0,
      otherDeductions: 0,
    },
  );

  const salaryExpense = roundMoney(totals.grossEarned + totals.employerBpjs);
  const bpjsPayable = roundMoney(totals.employeeBpjs + totals.employerBpjs);

  const journal = await postJournalEntry(tx, {
    date: run.endDate,
    description: `Payroll ${run.number} periode ${run.period}`,
    sourceType: "payroll-run",
    sourceId: run.id,
    sourceEvent: "approve",
    cashFlowCategory: "OPERATING",
    actorUserId,
    lines: [
      {
        accountKey: ACCOUNT_KEYS.SALARY_EXPENSE,
        debit: salaryExpense,
        description: `Beban gaji ${run.period}`,
      },
      {
        accountKey: ACCOUNT_KEYS.SALARY_PAYABLE,
        credit: roundMoney(totals.net),
        description: `Gaji bersih ${run.period}`,
      },
      ...(totals.pph21 > 0
        ? [
            {
              accountKey: ACCOUNT_KEYS.PPH21_PAYABLE,
              credit: roundMoney(totals.pph21),
              description: `PPh 21 ${run.period}`,
            },
          ]
        : []),
      ...(bpjsPayable > 0
        ? [
            {
              accountKey: ACCOUNT_KEYS.BPJS_PAYABLE,
              credit: bpjsPayable,
              description: `BPJS ${run.period}`,
            },
          ]
        : []),
      ...(totals.otherDeductions > 0
        ? [
            {
              accountKey: ACCOUNT_KEYS.OTHER_PAYABLE,
              credit: roundMoney(totals.otherDeductions),
              description: `Potongan lain ${run.period}`,
            },
          ]
        : []),
    ],
  });

  return { id: journal.id, number: journal.number };
}
