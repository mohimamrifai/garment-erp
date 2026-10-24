import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { materials, productVariants, suppliers } from "./master-data";
import { materialReceipts } from "./purchasing";
import { buyers } from "./sales";
import { shipments } from "./shipping";

/**
 * Akuntansi double-entry (F8).
 *
 * Prinsip:
 * - `journal_entries` + `journal_lines` adalah buku besar immutable setelah
 *   diposting. Koreksi dilakukan dengan jurnal pembalik, bukan edit/hapus.
 * - Setiap transaksi sumber (penerimaan, pengiriman, payroll, pembayaran)
 *   memakai `source_type + source_id + source_event` unik agar posting
 *   idempotent dan tidak menggandakan jurnal.
 * - `fiscal_periods` mengunci periode yang sudah ditutup.
 * - `inventory_costs` menyimpan nilai persediaan metode rata-rata tertimbang
 *   agar COGS dan nilai persediaan konsisten dengan mutasi stok.
 */

export const accountType = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const normalBalance = pgEnum("normal_balance", ["DEBIT", "CREDIT"]);

export const journalStatus = pgEnum("journal_status", ["DRAFT", "POSTED", "REVERSED"]);

export const fiscalPeriodStatus = pgEnum("fiscal_period_status", ["OPEN", "CLOSED"]);

export const cashFlowCategory = pgEnum("cash_flow_category", [
  "OPERATING",
  "INVESTING",
  "FINANCING",
]);

export const documentPaymentStatus = pgEnum("document_payment_status", [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
]);

export const paymentType = pgEnum("payment_type", ["RECEIPT", "PAYMENT"]);

export const paymentReferenceType = pgEnum("payment_reference_type", [
  "SALES_INVOICE",
  "PURCHASE_BILL",
  "PAYROLL_RUN",
]);

export const paymentPartyType = pgEnum("payment_party_type", [
  "BUYER",
  "SUPPLIER",
  "EMPLOYEE",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    normalBalance: normalBalance("normal_balance").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => accounts.id),
    isActive: boolean("is_active").notNull().default(true),
    /** Akun kas/bank yang boleh dipakai untuk pembayaran. */
    isCashBank: boolean("is_cash_bank").notNull().default(false),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("accounts_type_idx").on(t.type),
    index("accounts_parent_idx").on(t.parentId),
    check("accounts_code_chk", sql`length(trim(${t.code})) > 0`),
  ],
);

export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: fiscalPeriodStatus("status").notNull().default("OPEN"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("fiscal_periods_year_month_uq").on(t.year, t.month),
    index("fiscal_periods_status_idx").on(t.status),
    check("fiscal_periods_month_chk", sql`${t.month} between 1 and 12`),
    check("fiscal_periods_dates_chk", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor jurnal, mis. JE-202610-0001. */
    number: text("number").notNull().unique(),
    journalDate: date("journal_date").notNull(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => fiscalPeriods.id),
    description: text("description").notNull(),
    status: journalStatus("status").notNull().default("DRAFT"),
    cashFlowCategory: cashFlowCategory("cash_flow_category")
      .notNull()
      .default("OPERATING"),
    /** Dokumen sumber: material-receipt, shipment, payroll-run, payment, dll. */
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    sourceEvent: text("source_event").notNull().default("post"),
    reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: text("posted_by").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("journal_entries_date_idx").on(t.journalDate),
    index("journal_entries_period_idx").on(t.periodId),
    index("journal_entries_status_idx").on(t.status),
    index("journal_entries_source_idx").on(t.sourceType, t.sourceId),
    unique("journal_entries_source_uq").on(t.sourceType, t.sourceId, t.sourceEvent),
    check("journal_entries_source_chk", sql`length(trim(${t.sourceType})) > 0`),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    description: text("description"),
    debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.journalEntryId),
    index("journal_lines_account_idx").on(t.accountId),
    check(
      "journal_lines_amount_chk",
      sql`${t.debit} >= 0 and ${t.credit} >= 0 and (${t.debit} = 0 or ${t.credit} = 0) and (${t.debit} + ${t.credit}) > 0`,
    ),
  ],
);

/** Pemetaan peran akun (AR, AP, persediaan, dsb) ke COA yang aktif. */
export const accountMappings = pgTable(
  "account_mappings",
  {
    key: text("key").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    description: text("description"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_mappings_account_idx").on(t.accountId)],
);

export const accountingSettings = pgTable(
  "accounting_settings",
  {
    id: text("id").primaryKey().default("default"),
    /** Tarif PPN dalam persen, mis. 11.00. */
    ppnRate: numeric("ppn_rate", { precision: 5, scale: 2 }).notNull().default("11"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("accounting_settings_ppn_chk", sql`${t.ppnRate} >= 0 and ${t.ppnRate} <= 100`)],
);

/** Nilai persediaan rata-rata tertimbang per material/varian (global). */
export const inventoryCosts = pgTable(
  "inventory_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemType: text("item_type").notNull(),
    materialId: uuid("material_id").references(() => materials.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    quantityOnHand: numeric("quantity_on_hand", { precision: 16, scale: 4 })
      .notNull()
      .default("0"),
    totalValue: numeric("total_value", { precision: 18, scale: 2 }).notNull().default("0"),
    averageCost: numeric("average_cost", { precision: 18, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("inventory_costs_material_idx").on(t.materialId),
    index("inventory_costs_variant_idx").on(t.variantId),
    uniqueIndex("inventory_costs_material_uq")
      .on(t.materialId)
      .where(sql`${t.materialId} is not null`),
    uniqueIndex("inventory_costs_variant_uq")
      .on(t.variantId)
      .where(sql`${t.variantId} is not null`),
    check(
      "inventory_costs_item_chk",
      sql`num_nonnulls(${t.materialId}, ${t.variantId}) = 1`,
    ),
    check(
      "inventory_costs_item_type_chk",
      sql`(${t.itemType} = 'MATERIAL') = (${t.materialId} is not null)`,
    ),
    check("inventory_costs_quantity_chk", sql`${t.quantityOnHand} >= 0`),
    check("inventory_costs_value_chk", sql`${t.totalValue} >= 0 and ${t.averageCost} >= 0`),
  ],
);

/** Faktur penjualan otomatis dari surat jalan. */
export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor faktur, mis. INV-202610-0001. */
    number: text("number").notNull().unique(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => buyers.id),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: documentPaymentStatus("status").notNull().default("UNPAID"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 18, scale: 2 }).notNull().default("0"),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("sales_invoices_shipment_uq").on(t.shipmentId),
    index("sales_invoices_buyer_idx").on(t.buyerId),
    index("sales_invoices_status_idx").on(t.status),
    index("sales_invoices_due_date_idx").on(t.dueDate),
    check("sales_invoices_amount_chk", sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.total} >= 0 and ${t.amountPaid} >= 0 and ${t.amountPaid} <= ${t.total}`),
    check("sales_invoices_dates_chk", sql`${t.dueDate} >= ${t.invoiceDate}`),
  ],
);

export const salesInvoiceItems = pgTable(
  "sales_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    salesOrderItemId: uuid("sales_order_item_id"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [
    index("sales_invoice_items_invoice_idx").on(t.invoiceId),
    check("sales_invoice_items_qty_chk", sql`${t.quantity} > 0 and ${t.unitPrice} >= 0 and ${t.amount} >= 0`),
  ],
);

/** Tagihan pembelian otomatis dari penerimaan material. */
export const purchaseBills = pgTable(
  "purchase_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor tagihan, mis. BILL-202610-0001. */
    number: text("number").notNull().unique(),
    materialReceiptId: uuid("material_receipt_id")
      .notNull()
      .references(() => materialReceipts.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    billDate: date("bill_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: documentPaymentStatus("status").notNull().default("UNPAID"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 18, scale: 2 }).notNull().default("0"),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("purchase_bills_receipt_uq").on(t.materialReceiptId),
    index("purchase_bills_supplier_idx").on(t.supplierId),
    index("purchase_bills_status_idx").on(t.status),
    index("purchase_bills_due_date_idx").on(t.dueDate),
    check("purchase_bills_amount_chk", sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.total} >= 0 and ${t.amountPaid} >= 0 and ${t.amountPaid} <= ${t.total}`),
    check("purchase_bills_dates_chk", sql`${t.dueDate} >= ${t.billDate}`),
  ],
);

export const purchaseBillItems = pgTable(
  "purchase_bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => purchaseBills.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 16, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [
    index("purchase_bill_items_bill_idx").on(t.billId),
    check("purchase_bill_items_qty_chk", sql`${t.quantity} > 0 and ${t.unitPrice} >= 0 and ${t.amount} >= 0`),
  ],
);

/**
 * Pembayaran/penerimaan kas. Satu pembayaran merujuk tepat satu dokumen
 * (faktur, tagihan, atau payroll run) agar alokasi sederhana dan idempotent.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nomor pembayaran, mis. PAY-202610-0001. */
    number: text("number").notNull().unique(),
    type: paymentType("type").notNull(),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    referenceType: paymentReferenceType("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    partyType: paymentPartyType("party_type"),
    partyId: uuid("party_id"),
    notes: text("notes"),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_date_idx").on(t.paymentDate),
    index("payments_reference_idx").on(t.referenceType, t.referenceId),
    index("payments_account_idx").on(t.accountId),
    check("payments_amount_chk", sql`${t.amount} > 0`),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type FiscalPeriod = typeof fiscalPeriods.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
export type AccountMapping = typeof accountMappings.$inferSelect;
export type InventoryCost = typeof inventoryCosts.$inferSelect;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type PurchaseBill = typeof purchaseBills.$inferSelect;
export type Payment = typeof payments.$inferSelect;
