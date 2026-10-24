import { and, asc, count, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit";
import { db, type DbExecutor, type DbTransaction } from "@/lib/db";
import {
  accountMappings,
  accountingSettings,
  accounts,
  fiscalPeriods,
  journalEntries,
  journalLines,
  payments,
  purchaseBills,
  salesInvoices,
  type Account,
  type FiscalPeriod,
  type JournalEntry,
  type Payment,
} from "@/lib/db/schema";
import { getTodayDate } from "@/lib/utils/dates";
import { nextDocumentNumber } from "@/lib/utils/documents";
import { nullable } from "@/lib/utils/strings";
import {
  ACCOUNT_KEYS,
  DEFAULT_ACCOUNT_MAPPINGS,
  DEFAULT_ACCOUNTS,
  type AccountKey,
} from "./constants";

const MONEY_SCALE = 100;

export function roundMoney(value: number | string): number {
  return Math.round(Number(value) * MONEY_SCALE) / MONEY_SCALE;
}

export function toMoneyString(value: number | string): string {
  return roundMoney(value).toFixed(2);
}

function monthOf(date: string): string {
  return date.slice(0, 7).replace("-", "");
}

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest("Tanggal jurnal tidak valid (format YYYY-MM-DD).");
  }
}

function monthBounds(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Pastikan COA, pemetaan akun, dan pengaturan dasar tersedia. Dipanggil oleh
 * setiap posting agar instalasi baru / database tes dapat langsung memposting
 * tanpa langkah seed manual.
 */
export async function ensureAccountingReady(
  executor: DbExecutor,
): Promise<Map<AccountKey, string>> {
  await executor
    .insert(accountingSettings)
    .values({ id: "default", ppnRate: "11" })
    .onConflictDoNothing();

  await executor
    .insert(accounts)
    .values(
      DEFAULT_ACCOUNTS.map((account) => ({
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        isCashBank: account.isCashBank ?? false,
        bankName: account.bankName ?? null,
        accountNumber: account.accountNumber ?? null,
        description: account.description ?? null,
      })),
    )
    .onConflictDoNothing({ target: accounts.code });

  const rows = await executor
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(
      inArray(
        accounts.code,
        DEFAULT_ACCOUNTS.map((account) => account.code),
      ),
    );
  const byCode = new Map(rows.map((row) => [row.code, row.id]));

  const mappingValues = (Object.keys(DEFAULT_ACCOUNT_MAPPINGS) as AccountKey[])
    .map((key) => {
      const accountId = byCode.get(DEFAULT_ACCOUNT_MAPPINGS[key]);
      return accountId ? { key, accountId } : null;
    })
    .filter((value): value is { key: AccountKey; accountId: string } => value !== null);

  if (mappingValues.length > 0) {
    await executor.insert(accountMappings).values(mappingValues).onConflictDoNothing();
  }

  const mappingRows = await executor
    .select({ key: accountMappings.key, accountId: accountMappings.accountId })
    .from(accountMappings);
  return new Map(mappingRows.map((row) => [row.key as AccountKey, row.accountId]));
}

export async function getAccountIdByKey(
  executor: DbExecutor,
  key: AccountKey,
): Promise<string> {
  const map = await ensureAccountingReady(executor);
  const id = map.get(key);
  if (!id) throw ApiError.conflict(`Akun untuk ${key} belum dipetakan.`);
  return id;
}

export async function getPpnRate(executor: DbExecutor): Promise<number> {
  await executor
    .insert(accountingSettings)
    .values({ id: "default", ppnRate: "11" })
    .onConflictDoNothing();
  const [row] = await executor
    .select({ ppnRate: accountingSettings.ppnRate })
    .from(accountingSettings)
    .where(eq(accountingSettings.id, "default"))
    .limit(1);
  return Number(row?.ppnRate ?? 11) / 100;
}

export async function getOrCreateFiscalPeriod(
  executor: DbExecutor,
  date: string,
): Promise<FiscalPeriod> {
  assertIsoDate(date);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const bounds = monthBounds(year, month);

  await executor
    .insert(fiscalPeriods)
    .values({ year, month, ...bounds })
    .onConflictDoNothing({ target: [fiscalPeriods.year, fiscalPeriods.month] });

  const [period] = await executor
    .select()
    .from(fiscalPeriods)
    .where(and(eq(fiscalPeriods.year, year), eq(fiscalPeriods.month, month)))
    .limit(1);
  if (!period) throw ApiError.conflict("Periode akuntansi tidak dapat dibuat.");
  if (period.status === "CLOSED") {
    throw ApiError.conflict(
      `Periode akuntansi ${String(month).padStart(2, "0")}/${year} sudah ditutup.`,
    );
  }
  return period;
}

export type JournalLineInput = {
  accountId?: string;
  accountKey?: AccountKey;
  description?: string | null;
  debit?: number | string;
  credit?: number | string;
};

export type PostJournalInput = {
  date: string;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  sourceEvent?: string;
  cashFlowCategory?: "OPERATING" | "INVESTING" | "FINANCING";
  lines: JournalLineInput[];
  actorUserId: string | null;
};

type NormalizedLine = {
  accountId: string;
  description: string | null;
  debit: number;
  credit: number;
};

async function resolveLines(
  executor: DbExecutor,
  lines: JournalLineInput[],
): Promise<NormalizedLine[]> {
  const mapping = await ensureAccountingReady(executor);
  const accountIds = [
    ...new Set(
      lines
        .map((line) => line.accountId ?? (line.accountKey ? mapping.get(line.accountKey) : undefined))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (accountIds.length > 0) {
    const activeRows = await executor
      .select({ id: accounts.id, isActive: accounts.isActive })
      .from(accounts)
      .where(inArray(accounts.id, accountIds));
    const activeById = new Map(activeRows.map((row) => [row.id, row.isActive]));
    for (const accountId of accountIds) {
      if (!activeById.has(accountId)) throw ApiError.badRequest("Akun jurnal tidak ditemukan.");
      if (!activeById.get(accountId)) throw ApiError.badRequest("Akun jurnal sedang nonaktif.");
    }
  }

  const normalized = lines
    .map((line): NormalizedLine | null => {
      const accountId =
        line.accountId ?? (line.accountKey ? mapping.get(line.accountKey) : undefined);
      if (!accountId) {
        throw ApiError.badRequest("Setiap baris jurnal harus memiliki akun.");
      }
      const debit = roundMoney(line.debit ?? 0);
      const credit = roundMoney(line.credit ?? 0);
      if (debit < 0 || credit < 0) {
        throw ApiError.badRequest("Nilai debit/kredit tidak boleh negatif.");
      }
      if (debit > 0 && credit > 0) {
        throw ApiError.badRequest("Satu baris jurnal hanya boleh berisi debit atau kredit.");
      }
      if (debit === 0 && credit === 0) return null;
      return {
        accountId,
        description: nullable(line.description),
        debit,
        credit,
      };
    })
    .filter((line): line is NormalizedLine => line !== null);

  if (normalized.length < 2) {
    throw ApiError.badRequest("Jurnal minimal memiliki dua baris bernilai.");
  }
  return normalized;
}

function assertBalanced(lines: NormalizedLine[]): void {
  const totalDebit = lines.reduce((sum, line) => sum + Math.round(line.debit * MONEY_SCALE), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Math.round(line.credit * MONEY_SCALE), 0);
  if (totalDebit !== totalCredit) {
    throw ApiError.badRequest(
      `Jurnal tidak seimbang: debit ${toMoneyString(totalDebit / MONEY_SCALE)} vs kredit ${toMoneyString(totalCredit / MONEY_SCALE)}.`,
    );
  }
}

/**
 * Posting jurnal final. Idempotent berdasarkan sourceType/sourceId/sourceEvent.
 * WAJIB dipanggil di dalam transaksi yang sama dengan dokumen sumber.
 */
export async function postJournalEntry(
  tx: DbTransaction,
  input: PostJournalInput,
): Promise<JournalEntry> {
  assertIsoDate(input.date);
  const sourceEvent = input.sourceEvent ?? "post";

  if (input.sourceId) {
    const [existing] = await tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceType, input.sourceType),
          eq(journalEntries.sourceId, input.sourceId),
          eq(journalEntries.sourceEvent, sourceEvent),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  const lines = await resolveLines(tx, input.lines);
  assertBalanced(lines);
  const period = await getOrCreateFiscalPeriod(tx, input.date);
  const number = await nextDocumentNumber(tx, "JE", { period: monthOf(input.date) });

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      number,
      journalDate: input.date,
      periodId: period.id,
      description: input.description,
      status: "POSTED",
      cashFlowCategory: input.cashFlowCategory ?? "OPERATING",
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      sourceEvent,
      postedAt: new Date(),
      postedBy: input.actorUserId,
      createdBy: input.actorUserId,
    })
    .returning();
  if (!entry) throw ApiError.badRequest("Gagal membuat jurnal.");

  await tx.insert(journalLines).values(
    lines.map((line) => ({
      journalEntryId: entry.id,
      accountId: line.accountId,
      description: line.description,
      debit: toMoneyString(line.debit),
      credit: toMoneyString(line.credit),
    })),
  );

  await recordAudit(tx, {
    actorUserId: input.actorUserId,
    action: "journal.post",
    entityType: "journal-entry",
    entityId: entry.id,
    details: {
      number: entry.number,
      date: input.date,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      total: toMoneyString(lines.reduce((sum, line) => sum + line.debit, 0)),
    },
  });

  return entry;
}

export type CreateDraftJournalInput = {
  date: string;
  description: string;
  cashFlowCategory?: "OPERATING" | "INVESTING" | "FINANCING";
  lines: JournalLineInput[];
};

export async function createDraftJournal(
  input: CreateDraftJournalInput,
  actorUserId: string,
): Promise<JournalEntry> {
  return db.transaction(async (tx) => {
    assertIsoDate(input.date);
    const lines = await resolveLines(tx, input.lines);
    assertBalanced(lines);
    const period = await getOrCreateFiscalPeriod(tx, input.date);
    const number = await nextDocumentNumber(tx, "JE", { period: monthOf(input.date) });

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        number,
        journalDate: input.date,
        periodId: period.id,
        description: input.description,
        status: "DRAFT",
        cashFlowCategory: input.cashFlowCategory ?? "OPERATING",
        sourceType: "manual-journal",
        sourceEvent: `draft:${crypto.randomUUID()}`,
        createdBy: actorUserId,
      })
      .returning();
    if (!entry) throw ApiError.badRequest("Gagal membuat jurnal.");

    await tx.insert(journalLines).values(
      lines.map((line) => ({
        journalEntryId: entry.id,
        accountId: line.accountId,
        description: line.description,
        debit: toMoneyString(line.debit),
        credit: toMoneyString(line.credit),
      })),
    );

    await recordAudit(tx, {
      actorUserId,
      action: "journal.create",
      entityType: "journal-entry",
      entityId: entry.id,
      details: { number: entry.number, date: input.date },
    });
    return entry;
  });
}

export async function postDraftJournal(
  journalEntryId: string,
  actorUserId: string,
): Promise<JournalEntry> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, journalEntryId))
      .limit(1)
      .for("update");
    if (!entry) throw ApiError.notFound("Jurnal tidak ditemukan.");
    if (entry.status !== "DRAFT") throw ApiError.conflict("Hanya jurnal draf yang dapat diposting.");

    const lines = await tx
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, entry.id));
    const normalized = lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debit: Number(line.debit),
      credit: Number(line.credit),
    }));
    assertBalanced(normalized);
    await getOrCreateFiscalPeriod(tx, entry.journalDate);

    const [updated] = await tx
      .update(journalEntries)
      .set({ status: "POSTED", postedAt: new Date(), postedBy: actorUserId })
      .where(eq(journalEntries.id, entry.id))
      .returning();
    if (!updated) throw ApiError.notFound("Jurnal tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "journal.post",
      entityType: "journal-entry",
      entityId: entry.id,
      details: { number: entry.number, date: entry.journalDate },
    });
    return updated;
  });
}

export async function reverseJournal(
  journalEntryId: string,
  input: { date: string; reason: string },
  actorUserId: string,
): Promise<JournalEntry> {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, journalEntryId))
      .limit(1)
      .for("update");
    if (!original) throw ApiError.notFound("Jurnal tidak ditemukan.");
    if (original.status !== "POSTED") {
      throw ApiError.conflict("Hanya jurnal terposting yang dapat dibalik.");
    }

    const lines = await tx
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, original.id));
    if (lines.length === 0) throw ApiError.conflict("Jurnal tidak memiliki baris.");

    const period = await getOrCreateFiscalPeriod(tx, input.date);
    const number = await nextDocumentNumber(tx, "JE", { period: monthOf(input.date) });

    const [reversal] = await tx
      .insert(journalEntries)
      .values({
        number,
        journalDate: input.date,
        periodId: period.id,
        description: `Pembalik ${original.number} — ${input.reason}`,
        status: "POSTED",
        cashFlowCategory: original.cashFlowCategory,
        sourceType: "journal-reversal",
        sourceId: original.id,
        sourceEvent: "reverse",
        reversalOfId: original.id,
        postedAt: new Date(),
        postedBy: actorUserId,
        createdBy: actorUserId,
      })
      .returning();
    if (!reversal) throw ApiError.badRequest("Gagal membuat jurnal pembalik.");

    await tx.insert(journalLines).values(
      lines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        description: line.description,
        debit: line.credit,
        credit: line.debit,
      })),
    );

    await tx
      .update(journalEntries)
      .set({ status: "REVERSED" })
      .where(eq(journalEntries.id, original.id));

    await recordAudit(tx, {
      actorUserId,
      action: "journal.reverse",
      entityType: "journal-entry",
      entityId: original.id,
      details: { number: original.number, reversalNumber: reversal.number, reason: input.reason },
    });
    return reversal;
  });
}

export async function closeFiscalPeriod(
  year: number,
  month: number,
  actorUserId: string,
): Promise<FiscalPeriod> {
  return db.transaction(async (tx) => {
    const period = await getOrCreateFiscalPeriod(tx, `${year}-${String(month).padStart(2, "0")}-01`);
    if (period.status === "CLOSED") throw ApiError.conflict("Periode ini sudah ditutup.");

    const [draft] = await tx
      .select({ value: count() })
      .from(journalEntries)
      .where(and(eq(journalEntries.periodId, period.id), eq(journalEntries.status, "DRAFT")));
    if (Number(draft?.value ?? 0) > 0) {
      throw ApiError.conflict("Masih ada jurnal draf pada periode ini. Posting atau hapus draf terlebih dahulu.");
    }

    const [updated] = await tx
      .update(fiscalPeriods)
      .set({ status: "CLOSED", closedAt: new Date(), closedBy: actorUserId })
      .where(eq(fiscalPeriods.id, period.id))
      .returning();
    if (!updated) throw ApiError.notFound("Periode akuntansi tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "fiscal-period.close",
      entityType: "fiscal-period",
      entityId: period.id,
      details: { year, month },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Pembayaran & subledger AR/AP                                       */
/* ------------------------------------------------------------------ */

export type CreatePaymentInput = {
  type: "RECEIPT" | "PAYMENT";
  date: string;
  amount: number;
  accountId: string;
  referenceType: "SALES_INVOICE" | "PURCHASE_BILL" | "PAYROLL_RUN";
  referenceId: string;
  notes?: string;
};

function statusForPayment(total: number, paid: number): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIALLY_PAID";
}

export async function createPayment(
  input: CreatePaymentInput,
  actorUserId: string,
): Promise<Payment> {
  return db.transaction(async (tx) => {
    assertIsoDate(input.date);
    const amount = roundMoney(input.amount);
    if (amount <= 0) throw ApiError.badRequest("Jumlah pembayaran harus lebih dari 0.");

    const [cashAccount] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.accountId))
      .limit(1);
    if (!cashAccount) throw ApiError.badRequest("Akun kas/bank tidak ditemukan.");
    if (!cashAccount.isActive) throw ApiError.badRequest("Akun kas/bank sedang nonaktif.");
    if (!cashAccount.isCashBank) throw ApiError.badRequest("Akun yang dipilih bukan akun kas/bank.");

    const number = await nextDocumentNumber(tx, "PAY", { period: monthOf(input.date) });
    let partyType: "BUYER" | "SUPPLIER" | "EMPLOYEE" | null = null;
    let partyId: string | null = null;
    let lines: JournalLineInput[] = [];
    let description = "";

    if (input.referenceType === "SALES_INVOICE") {
      if (input.type !== "RECEIPT") {
        throw ApiError.badRequest("Faktur penjualan hanya dapat dilunasi dengan penerimaan kas.");
      }
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, input.referenceId))
        .limit(1)
        .for("update");
      if (!invoice) throw ApiError.notFound("Faktur penjualan tidak ditemukan.");
      if (invoice.status === "CANCELLED") throw ApiError.conflict("Faktur sudah dibatalkan.");
      const outstanding = roundMoney(Number(invoice.total) - Number(invoice.amountPaid));
      if (amount > outstanding) {
        throw ApiError.conflict(`Jumlah melebihi sisa tagihan (${toMoneyString(outstanding)}).`);
      }
      const nextPaid = roundMoney(Number(invoice.amountPaid) + amount);
      await tx
        .update(salesInvoices)
        .set({ amountPaid: toMoneyString(nextPaid), status: statusForPayment(Number(invoice.total), nextPaid) })
        .where(eq(salesInvoices.id, invoice.id));
      partyType = "BUYER";
      partyId = invoice.buyerId;
      description = `Penerimaan pembayaran faktur ${invoice.number}`;
      lines = [
        { accountId: cashAccount.id, debit: amount, credit: 0, description },
        { accountKey: ACCOUNT_KEYS.ACCOUNTS_RECEIVABLE, debit: 0, credit: amount, description },
      ];
    } else if (input.referenceType === "PURCHASE_BILL") {
      if (input.type !== "PAYMENT") {
        throw ApiError.badRequest("Tagihan pembelian hanya dapat dibayar dengan pengeluaran kas.");
      }
      const [bill] = await tx
        .select()
        .from(purchaseBills)
        .where(eq(purchaseBills.id, input.referenceId))
        .limit(1)
        .for("update");
      if (!bill) throw ApiError.notFound("Tagihan pembelian tidak ditemukan.");
      if (bill.status === "CANCELLED") throw ApiError.conflict("Tagihan sudah dibatalkan.");
      const outstanding = roundMoney(Number(bill.total) - Number(bill.amountPaid));
      if (amount > outstanding) {
        throw ApiError.conflict(`Jumlah melebihi sisa tagihan (${toMoneyString(outstanding)}).`);
      }
      const nextPaid = roundMoney(Number(bill.amountPaid) + amount);
      await tx
        .update(purchaseBills)
        .set({ amountPaid: toMoneyString(nextPaid), status: statusForPayment(Number(bill.total), nextPaid) })
        .where(eq(purchaseBills.id, bill.id));
      partyType = "SUPPLIER";
      partyId = bill.supplierId;
      description = `Pembayaran tagihan ${bill.number}`;
      lines = [
        { accountKey: ACCOUNT_KEYS.ACCOUNTS_PAYABLE, debit: amount, credit: 0, description },
        { accountId: cashAccount.id, debit: 0, credit: amount, description },
      ];
    } else {
      if (input.type !== "PAYMENT") {
        throw ApiError.badRequest("Payroll hanya dapat dibayar dengan pengeluaran kas.");
      }
      const { payrollRuns } = await import("@/lib/db/schema/hr");
      const [run] = await tx
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, input.referenceId))
        .limit(1)
        .for("update");
      if (!run) throw ApiError.notFound("Payroll tidak ditemukan.");
      if (run.status === "PAID") throw ApiError.conflict("Payroll ini sudah dibayar.");
      if (run.status !== "APPROVED") {
        throw ApiError.conflict("Payroll harus disetujui sebelum dibayar.");
      }
      const net = roundMoney(run.totalNet);
      if (amount !== net) {
        throw ApiError.conflict(`Pembayaran payroll harus sama dengan gaji bersih (${toMoneyString(net)}).`);
      }
      await tx
        .update(payrollRuns)
        .set({ status: "PAID", paidAt: new Date(), paymentAccountId: cashAccount.id })
        .where(eq(payrollRuns.id, run.id));
      partyType = "EMPLOYEE";
      description = `Pembayaran payroll ${run.number}`;
      lines = [
        { accountKey: ACCOUNT_KEYS.SALARY_PAYABLE, debit: amount, credit: 0, description },
        { accountId: cashAccount.id, debit: 0, credit: amount, description },
      ];
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        number,
        type: input.type,
        paymentDate: input.date,
        amount: toMoneyString(amount),
        accountId: cashAccount.id,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        partyType,
        partyId,
        notes: nullable(input.notes),
        createdBy: actorUserId,
      })
      .returning();
    if (!payment) throw ApiError.badRequest("Gagal membuat pembayaran.");

    const journal = await postJournalEntry(tx, {
      date: input.date,
      description,
      sourceType: "payment",
      sourceId: payment.id,
      sourceEvent: "post",
      cashFlowCategory: "OPERATING",
      lines,
      actorUserId,
    });

    const [updated] = await tx
      .update(payments)
      .set({ journalEntryId: journal.id })
      .where(eq(payments.id, payment.id))
      .returning();

    await recordAudit(tx, {
      actorUserId,
      action: "payment.create",
      entityType: "payment",
      entityId: payment.id,
      details: {
        number: payment.number,
        type: input.type,
        amount: toMoneyString(amount),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });
    return updated ?? payment;
  });
}

/* ------------------------------------------------------------------ */
/* Query baca                                                          */
/* ------------------------------------------------------------------ */

export type AccountListRow = Account & {
  journalLineCount: number;
};

export async function createAccount(
  input: {
    code: string;
    name: string;
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    normalBalance: "DEBIT" | "CREDIT";
    parentId?: string;
    isCashBank: boolean;
    bankName?: string;
    accountNumber?: string;
    description?: string;
  },
  actorUserId: string,
): Promise<Account> {
  return db.transaction(async (tx) => {
    if (input.isCashBank && input.type !== "ASSET") {
      throw ApiError.badRequest("Akun kas/bank harus bertipe aset.");
    }
    if (input.parentId) {
      const [parent] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.parentId))
        .limit(1);
      if (!parent) throw ApiError.badRequest("Akun induk tidak ditemukan.");
    }
    const [existing] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.code, input.code))
      .limit(1);
    if (existing) throw ApiError.conflict("Kode akun sudah dipakai.");

    const [account] = await tx
      .insert(accounts)
      .values({
        code: input.code,
        name: input.name,
        type: input.type,
        normalBalance: input.normalBalance,
        parentId: input.parentId || null,
        isCashBank: input.isCashBank,
        bankName: nullable(input.bankName),
        accountNumber: nullable(input.accountNumber),
        description: nullable(input.description),
      })
      .returning();
    if (!account) throw ApiError.badRequest("Gagal membuat akun.");

    await recordAudit(tx, {
      actorUserId,
      action: "account.create",
      entityType: "account",
      entityId: account.id,
      details: { code: account.code, name: account.name },
    });
    return account;
  });
}

export async function updateAccount(
  accountId: string,
  input: {
    code?: string;
    name?: string;
    type?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    normalBalance?: "DEBIT" | "CREDIT";
    parentId?: string;
    isCashBank?: boolean;
    bankName?: string;
    accountNumber?: string;
    description?: string;
    isActive?: boolean;
  },
  actorUserId: string,
): Promise<Account> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)
      .for("update");
    if (!existing) throw ApiError.notFound("Akun tidak ditemukan.");

    const nextType = input.type ?? existing.type;
    const nextCashBank = input.isCashBank ?? existing.isCashBank;
    if (nextCashBank && nextType !== "ASSET") {
      throw ApiError.badRequest("Akun kas/bank harus bertipe aset.");
    }
    if (input.parentId) {
      if (input.parentId === accountId) throw ApiError.badRequest("Akun tidak dapat menjadi induk dirinya sendiri.");
      const [parent] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.parentId))
        .limit(1);
      if (!parent) throw ApiError.badRequest("Akun induk tidak ditemukan.");
    }
    if (input.code && input.code !== existing.code) {
      const [duplicate] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.code, input.code))
        .limit(1);
      if (duplicate) throw ApiError.conflict("Kode akun sudah dipakai.");
    }
    if (input.isActive === false) {
      const [mapped] = await tx
        .select({ key: accountMappings.key })
        .from(accountMappings)
        .where(eq(accountMappings.accountId, accountId))
        .limit(1);
      if (mapped) {
        throw ApiError.conflict("Akun ini dipakai pemetaan otomatis dan tidak dapat dinonaktifkan.");
      }
    }

    const updates: Partial<typeof accounts.$inferInsert> = {};
    if (input.code !== undefined) updates.code = input.code;
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.normalBalance !== undefined) updates.normalBalance = input.normalBalance;
    if (input.parentId !== undefined) updates.parentId = input.parentId || null;
    if (input.isCashBank !== undefined) updates.isCashBank = input.isCashBank;
    if (input.bankName !== undefined) updates.bankName = nullable(input.bankName);
    if (input.accountNumber !== undefined) updates.accountNumber = nullable(input.accountNumber);
    if (input.description !== undefined) updates.description = nullable(input.description);
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("Tidak ada perubahan yang dikirim.");
    }

    const [updated] = await tx
      .update(accounts)
      .set(updates)
      .where(eq(accounts.id, accountId))
      .returning();
    if (!updated) throw ApiError.notFound("Akun tidak ditemukan.");

    await recordAudit(tx, {
      actorUserId,
      action: "account.update",
      entityType: "account",
      entityId: accountId,
      details: { code: existing.code, changes: updates },
    });
    return updated;
  });
}

export async function listAccounts(params: {
  query?: string;
  type?: string;
}): Promise<{ items: Account[]; total: number }> {
  await ensureAccountingReady(db);
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(sql`${accounts.code} ilike ${pattern}`, sql`${accounts.name} ilike ${pattern}`));
  }
  if (params.type && params.type !== "all") {
    conditions.push(sql`${accounts.type}::text = ${params.type}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ value: count() }).from(accounts).where(where);
  const items = await db
    .select()
    .from(accounts)
    .where(where)
    .orderBy(asc(accounts.code));
  return { items, total: Number(totalRow?.value ?? 0) };
}

export async function listCashBankAccounts(): Promise<Account[]> {
  await ensureAccountingReady(db);
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isCashBank, true), eq(accounts.isActive, true)))
    .orderBy(asc(accounts.code));
}

export type JournalListRow = {
  id: string;
  number: string;
  date: string;
  description: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  sourceType: string;
  sourceEvent: string;
  total: string;
  postedByName: string | null;
};

export async function listJournals(params: {
  query?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: JournalListRow[]; total: number }> {
  const conditions = [];
  const search = params.query?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(sql`${journalEntries.number} ilike ${pattern}`, sql`${journalEntries.description} ilike ${pattern}`));
  }
  if (params.status && params.status !== "all") {
    conditions.push(sql`${journalEntries.status}::text = ${params.status}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ value: count() }).from(journalEntries).where(where);
  const rows = await db
    .select({
      id: journalEntries.id,
      number: journalEntries.number,
      date: journalEntries.journalDate,
      description: journalEntries.description,
      status: journalEntries.status,
      sourceType: journalEntries.sourceType,
      sourceEvent: journalEntries.sourceEvent,
      total: sql<string>`coalesce((select sum(jl.debit) from journal_lines jl where jl.journal_entry_id = journal_entries.id), 0)`,
      postedByName: sql<string | null>`(select u.name from "user" u where u.id = journal_entries.posted_by)`,
    })
    .from(journalEntries)
    .where(where)
    .orderBy(desc(journalEntries.journalDate), desc(journalEntries.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);
  return { items: rows, total: Number(totalRow?.value ?? 0) };
}

export type JournalDetail = {
  entry: JournalEntry;
  lines: {
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
    debit: string;
    credit: string;
  }[];
};

export async function getJournalDetail(journalEntryId: string): Promise<JournalDetail> {
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, journalEntryId))
    .limit(1);
  if (!entry) throw ApiError.notFound("Jurnal tidak ditemukan.");
  const lines = await db
    .select({
      id: journalLines.id,
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(eq(journalLines.journalEntryId, entry.id))
    .orderBy(asc(accounts.code));
  return { entry, lines };
}

export async function listFiscalPeriods(year?: number): Promise<FiscalPeriod[]> {
  const where = year ? eq(fiscalPeriods.year, year) : undefined;
  return db
    .select()
    .from(fiscalPeriods)
    .where(where)
    .orderBy(desc(fiscalPeriods.year), desc(fiscalPeriods.month));
}

export type PaymentListRow = {
  id: string;
  number: string;
  type: "RECEIPT" | "PAYMENT";
  date: string;
  amount: string;
  accountName: string;
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: Date;
};

export async function listPayments(params: {
  type?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: PaymentListRow[]; total: number }> {
  const conditions = [];
  if (params.type && params.type !== "all") {
    conditions.push(sql`${payments.type}::text = ${params.type}`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ value: count() }).from(payments).where(where);
  const rows = await db
    .select({
      id: payments.id,
      number: payments.number,
      type: payments.type,
      date: payments.paymentDate,
      amount: payments.amount,
      accountName: accounts.name,
      referenceType: payments.referenceType,
      referenceId: payments.referenceId,
      referenceNumber: sql<string | null>`case ${payments.referenceType}
        when 'SALES_INVOICE' then (select number from sales_invoices si where si.id = ${payments.referenceId})
        when 'PURCHASE_BILL' then (select number from purchase_bills pb where pb.id = ${payments.referenceId})
        when 'PAYROLL_RUN' then (select number from payroll_runs pr where pr.id = ${payments.referenceId})
        else null end`,
      notes: payments.notes,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(accounts, eq(payments.accountId, accounts.id))
    .where(where)
    .orderBy(desc(payments.paymentDate), desc(payments.number))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);
  return { items: rows, total: Number(totalRow?.value ?? 0) };
}

export type OutstandingInvoice = {
  id: string;
  number: string;
  partyName: string;
  date: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  outstanding: string;
};

export async function listOutstandingInvoices(): Promise<OutstandingInvoice[]> {
  const rows = await db
    .select({
      id: salesInvoices.id,
      number: salesInvoices.number,
      partyName: sql<string>`(select b.name from buyers b where b.id = sales_invoices.buyer_id)`,
      date: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      total: salesInvoices.total,
      amountPaid: salesInvoices.amountPaid,
      outstanding: sql<string>`(${salesInvoices.total} - ${salesInvoices.amountPaid})`,
    })
    .from(salesInvoices)
    .where(and(ne(salesInvoices.status, "PAID"), ne(salesInvoices.status, "CANCELLED")))
    .orderBy(asc(salesInvoices.dueDate));
  return rows;
}

export async function listOutstandingBills(): Promise<OutstandingInvoice[]> {
  const rows = await db
    .select({
      id: purchaseBills.id,
      number: purchaseBills.number,
      partyName: sql<string>`(select s.name from suppliers s where s.id = purchase_bills.supplier_id)`,
      date: purchaseBills.billDate,
      dueDate: purchaseBills.dueDate,
      total: purchaseBills.total,
      amountPaid: purchaseBills.amountPaid,
      outstanding: sql<string>`(${purchaseBills.total} - ${purchaseBills.amountPaid})`,
    })
    .from(purchaseBills)
    .where(and(ne(purchaseBills.status, "PAID"), ne(purchaseBills.status, "CANCELLED")))
    .orderBy(asc(purchaseBills.dueDate));
  return rows;
}

export async function getFinanceSummary(): Promise<{
  cashBalance: number;
  receivables: number;
  payables: number;
  revenue: number;
  expenses: number;
  netIncome: number;
}> {
  await ensureAccountingReady(db);
  const [cash] = await db
    .select({
      value: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(eq(accounts.isCashBank, true), inArray(journalEntries.status, ["POSTED", "REVERSED"])));

  const [ar] = await db
    .select({ value: sql<string>`coalesce(sum(${salesInvoices.total} - ${salesInvoices.amountPaid}), 0)` })
    .from(salesInvoices)
    .where(and(ne(salesInvoices.status, "PAID"), ne(salesInvoices.status, "CANCELLED")));
  const [ap] = await db
    .select({ value: sql<string>`coalesce(sum(${purchaseBills.total} - ${purchaseBills.amountPaid}), 0)` })
    .from(purchaseBills)
    .where(and(ne(purchaseBills.status, "PAID"), ne(purchaseBills.status, "CANCELLED")));

  const today = getTodayDate();
  const bounds = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const periodWhere = and(
    inArray(journalEntries.status, ["POSTED", "REVERSED"]),
    gte(journalEntries.journalDate, bounds.startDate),
    lte(journalEntries.journalDate, bounds.endDate),
  );

  const [revenue] = await db
    .select({
      value: sql<string>`coalesce(sum(case when ${accounts.type} = 'REVENUE' then ${journalLines.credit} - ${journalLines.debit} else 0 end), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(periodWhere);

  const [expense] = await db
    .select({
      value: sql<string>`coalesce(sum(case when ${accounts.type} = 'EXPENSE' then ${journalLines.debit} - ${journalLines.credit} else 0 end), 0)`,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(periodWhere);

  const revenueValue = Number(revenue?.value ?? 0);
  const expenseValue = Number(expense?.value ?? 0);
  return {
    cashBalance: Number(cash?.value ?? 0),
    receivables: Number(ar?.value ?? 0),
    payables: Number(ap?.value ?? 0),
    revenue: revenueValue,
    expenses: expenseValue,
    netIncome: revenueValue - expenseValue,
  };
}

export async function listRecentJournals(limit = 8): Promise<JournalListRow[]> {
  const { items } = await listJournals({ page: 1, pageSize: limit });
  return items;
}
