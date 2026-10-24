import { z } from "zod";

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export const NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const;
export const CASH_FLOW_CATEGORIES = ["OPERATING", "INVESTING", "FINANCING"] as const;
export const CASH_FLOW_LABELS: Record<(typeof CASH_FLOW_CATEGORIES)[number], string> = {
  OPERATING: "Operasional",
  INVESTING: "Investasi",
  FINANCING: "Pendanaan",
};

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const listAccountsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  type: z.enum(["all", ...ACCOUNT_TYPES]).default("all"),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

export const accountFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode akun wajib diisi.")
    .max(20, "Kode akun maksimal 20 karakter.")
    .regex(/^[0-9A-Za-z.-]+$/, "Kode akun hanya boleh berisi huruf, angka, titik, dan strip."),
  name: z.string().trim().min(2, "Nama akun minimal 2 karakter.").max(150),
  type: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentId: z.union([z.uuid(), z.literal("")]).optional(),
  isCashBank: z.boolean(),
  bankName: optionalText(100),
  accountNumber: optionalText(50),
  description: optionalText(500),
});
export type AccountFormInput = z.infer<typeof accountFormSchema>;

export const updateAccountSchema = accountFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const listJournalsQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["all", "DRAFT", "POSTED", "REVERSED"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>;

const journalLineSchema = z.object({
  accountId: z.uuid("Pilih akun."),
  description: optionalText(200),
  debit: z.number({ error: "Masukkan angka debit." }).min(0),
  credit: z.number({ error: "Masukkan angka kredit." }).min(0),
});

export const journalFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  description: z.string().trim().min(3, "Keterangan minimal 3 karakter.").max(500),
  cashFlowCategory: z.enum(CASH_FLOW_CATEGORIES),
  lines: z.array(journalLineSchema).min(2, "Jurnal minimal dua baris."),
});
export type JournalFormInput = z.infer<typeof journalFormSchema>;

export const reverseJournalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(500),
});
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;

export const listPaymentsQuerySchema = z.object({
  type: z.enum(["all", "RECEIPT", "PAYMENT"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const paymentFormSchema = z.object({
  type: z.enum(["RECEIPT", "PAYMENT"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  amount: z.number({ error: "Masukkan jumlah pembayaran." }).positive("Jumlah harus lebih dari 0."),
  accountId: z.uuid("Pilih akun kas/bank."),
  referenceType: z.enum(["SALES_INVOICE", "PURCHASE_BILL", "PAYROLL_RUN"]),
  referenceId: z.uuid("Pilih dokumen."),
  notes: optionalText(500),
});
export type PaymentFormInput = z.infer<typeof paymentFormSchema>;

export const closePeriodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;
