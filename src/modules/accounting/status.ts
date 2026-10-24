export const JOURNAL_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  DRAFT: "Draf",
  POSTED: "Terposting",
  REVERSED: "Dibalik",
};

export const PAYMENT_TYPES = ["RECEIPT", "PAYMENT"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  RECEIPT: "Penerimaan",
  PAYMENT: "Pembayaran",
};

export const PAYMENT_REFERENCE_LABELS: Record<string, string> = {
  SALES_INVOICE: "Faktur penjualan",
  PURCHASE_BILL: "Tagihan pembelian",
  PAYROLL_RUN: "Payroll",
};

export const FISCAL_PERIOD_STATUS_LABELS: Record<string, string> = {
  OPEN: "Terbuka",
  CLOSED: "Ditutup",
};

export const DOCUMENT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Belum dibayar",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  CANCELLED: "Dibatalkan",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  "purchase-bill": "Tagihan pembelian",
  "sales-invoice": "Faktur penjualan",
  "material-issue": "Pemakaian material",
  "finished-goods-lot": "Barang jadi",
  "payroll-run": "Payroll",
  "manual-journal": "Jurnal manual",
  "journal-reversal": "Pembalik jurnal",
  payment: "Pembayaran",
};
