/**
 * COA & pemetaan akun standar (F8).
 *
 * Kode akun sengaja stabil karena dipakai pemetaan otomatis. Pengguna boleh
 * mengganti nama akun, tetapi jangan mengganti kode akun sistem.
 */

export const ACCOUNT_KEYS = {
  CASH: "CASH",
  BANK: "BANK",
  ACCOUNTS_RECEIVABLE: "ACCOUNTS_RECEIVABLE",
  ACCOUNTS_PAYABLE: "ACCOUNTS_PAYABLE",
  VAT_INPUT: "VAT_INPUT",
  VAT_OUTPUT: "VAT_OUTPUT",
  INVENTORY_MATERIAL: "INVENTORY_MATERIAL",
  INVENTORY_FINISHED_GOODS: "INVENTORY_FINISHED_GOODS",
  WORK_IN_PROCESS: "WORK_IN_PROCESS",
  COST_OF_GOODS_SOLD: "COST_OF_GOODS_SOLD",
  SALES_REVENUE: "SALES_REVENUE",
  SALARY_EXPENSE: "SALARY_EXPENSE",
  SALARY_PAYABLE: "SALARY_PAYABLE",
  PPH21_PAYABLE: "PPH21_PAYABLE",
  BPJS_PAYABLE: "BPJS_PAYABLE",
  OTHER_PAYABLE: "OTHER_PAYABLE",
  PRODUCTION_VARIANCE: "PRODUCTION_VARIANCE",
  OTHER_INCOME: "OTHER_INCOME",
  OTHER_EXPENSE: "OTHER_EXPENSE",
  RETAINED_EARNINGS: "RETAINED_EARNINGS",
} as const;

export type AccountKey = (typeof ACCOUNT_KEYS)[keyof typeof ACCOUNT_KEYS];

export type DefaultAccount = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  isCashBank?: boolean;
  bankName?: string;
  accountNumber?: string;
  description?: string;
};

/** COA minimum agar seluruh posting otomatis dapat berjalan. */
export const DEFAULT_ACCOUNTS: readonly DefaultAccount[] = [
  {
    code: "1001",
    name: "Kas",
    type: "ASSET",
    normalBalance: "DEBIT",
    isCashBank: true,
    description: "Kas tunai di kantor.",
  },
  {
    code: "1002",
    name: "Bank",
    type: "ASSET",
    normalBalance: "DEBIT",
    isCashBank: true,
    bankName: "Bank Operasional",
    description: "Rekening bank operasional perusahaan.",
  },
  {
    code: "1010",
    name: "Piutang Usaha",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Tagihan kepada buyer dari faktur penjualan.",
  },
  {
    code: "1020",
    name: "Persediaan Bahan Baku",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Nilai persediaan material dengan metode rata-rata tertimbang.",
  },
  {
    code: "1030",
    name: "Persediaan Barang Jadi",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Nilai persediaan barang jadi siap kirim.",
  },
  {
    code: "1040",
    name: "PPN Masukan",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Pajak pertambahan nilai atas pembelian.",
  },
  {
    code: "1050",
    name: "Barang Dalam Proses",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Akumulasi biaya material yang sudah dikeluarkan untuk produksi.",
  },
  {
    code: "2001",
    name: "Utang Usaha",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Kewajiban kepada supplier atas penerimaan material.",
  },
  {
    code: "2010",
    name: "Utang Gaji",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Gaji bersih yang belum dibayarkan.",
  },
  {
    code: "2020",
    name: "Utang PPh 21",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Pajak penghasilan karyawan yang belum disetor.",
  },
  {
    code: "2030",
    name: "Utang BPJS",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Iuran BPJS karyawan dan perusahaan yang belum disetor.",
  },
  {
    code: "2040",
    name: "PPN Keluaran",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Pajak pertambahan nilai atas penjualan.",
  },
  {
    code: "2050",
    name: "Utang Lain-lain",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Potongan lain karyawan yang belum disetor.",
  },
  {
    code: "3001",
    name: "Modal Disetor",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
  {
    code: "3002",
    name: "Laba Ditahan",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
  {
    code: "4001",
    name: "Penjualan",
    type: "REVENUE",
    normalBalance: "CREDIT",
    description: "Pendapatan dari pengiriman barang jadi.",
  },
  {
    code: "4002",
    name: "Pendapatan Lain",
    type: "REVENUE",
    normalBalance: "CREDIT",
  },
  {
    code: "5001",
    name: "Harga Pokok Penjualan",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5002",
    name: "Beban Gaji",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5003",
    name: "Beban Umum",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5004",
    name: "Selisih Produksi",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Selisih biaya material produksi terhadap barang jadi.",
  },
];

/** Pemetaan peran akun → kode akun standar. */
export const DEFAULT_ACCOUNT_MAPPINGS: Readonly<Record<AccountKey, string>> = {
  CASH: "1001",
  BANK: "1002",
  ACCOUNTS_RECEIVABLE: "1010",
  ACCOUNTS_PAYABLE: "2001",
  VAT_INPUT: "1040",
  VAT_OUTPUT: "2040",
  INVENTORY_MATERIAL: "1020",
  INVENTORY_FINISHED_GOODS: "1030",
  WORK_IN_PROCESS: "1050",
  COST_OF_GOODS_SOLD: "5001",
  SALES_REVENUE: "4001",
  SALARY_EXPENSE: "5002",
  SALARY_PAYABLE: "2010",
  PPH21_PAYABLE: "2020",
  BPJS_PAYABLE: "2030",
  OTHER_PAYABLE: "2050",
  PRODUCTION_VARIANCE: "5004",
  OTHER_INCOME: "4002",
  OTHER_EXPENSE: "5003",
  RETAINED_EARNINGS: "3002",
};

export const ACCOUNT_KEY_LABELS: Readonly<Record<AccountKey, string>> = {
  CASH: "Kas",
  BANK: "Bank",
  ACCOUNTS_RECEIVABLE: "Piutang Usaha",
  ACCOUNTS_PAYABLE: "Utang Usaha",
  VAT_INPUT: "PPN Masukan",
  VAT_OUTPUT: "PPN Keluaran",
  INVENTORY_MATERIAL: "Persediaan Bahan Baku",
  INVENTORY_FINISHED_GOODS: "Persediaan Barang Jadi",
  WORK_IN_PROCESS: "Barang Dalam Proses",
  COST_OF_GOODS_SOLD: "Harga Pokok Penjualan",
  SALES_REVENUE: "Penjualan",
  SALARY_EXPENSE: "Beban Gaji",
  SALARY_PAYABLE: "Utang Gaji",
  PPH21_PAYABLE: "Utang PPh 21",
  BPJS_PAYABLE: "Utang BPJS",
  OTHER_PAYABLE: "Utang Lain-lain",
  PRODUCTION_VARIANCE: "Selisih Produksi",
  OTHER_INCOME: "Pendapatan Lain",
  OTHER_EXPENSE: "Beban Umum",
  RETAINED_EARNINGS: "Laba Ditahan",
};
