import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { getTodayDate } from "@/lib/utils/dates";
import { ACCOUNT_KEYS } from "@/modules/accounting/constants";
import {
  closeFiscalPeriod,
  createDraftJournal,
  ensureAccountingReady,
  getFinanceSummary,
  postDraftJournal,
  postJournalEntry,
  reverseJournal,
} from "@/modules/accounting/service";
import { buildReport } from "@/modules/reports/service";
import { TEST_ACTOR_ID } from "../helpers/constants";

describe("akuntansi (integrasi DB)", () => {
  it("menyiapkan COA, membuat jurnal draf, posting, dan laporan neraca saldo", async () => {
    const mapping = await ensureAccountingReady(db);
    expect(mapping.get(ACCOUNT_KEYS.CASH)).toBeTruthy();
    expect(mapping.get(ACCOUNT_KEYS.SALES_REVENUE)).toBeTruthy();

    const today = getTodayDate();
    const draft = await createDraftJournal(
      {
        date: today,
        description: "Uji jurnal manual",
        lines: [
          { accountKey: ACCOUNT_KEYS.CASH, debit: 1_500_000, credit: 0 },
          { accountKey: ACCOUNT_KEYS.SALES_REVENUE, debit: 0, credit: 1_500_000 },
        ],
      },
      TEST_ACTOR_ID,
    );
    expect(draft.status).toBe("DRAFT");

    const posted = await postDraftJournal(draft.id, TEST_ACTOR_ID);
    expect(posted.status).toBe("POSTED");
    expect(posted.postedAt).toBeTruthy();

    const trial = await buildReport("trial-balance", { from: today, to: today });
    expect(trial.summary.find((item) => item.label === "Selisih")?.value.replace(/\u00a0/g, " ")).toBe("Rp 0");
    expect(trial.rows.some((row) => Number(row.debit) === 1_500_000)).toBe(true);

    const summary = await getFinanceSummary();
    expect(summary.cashBalance).toBe(1_500_000);
    expect(summary.revenue).toBe(1_500_000);
    expect(summary.netIncome).toBe(1_500_000);

    const income = await buildReport("income-statement", { from: today, to: today });
    expect(income.summary.find((item) => item.label === "Laba bersih")?.value.replace(/\u00a0/g, " ")).toBe(
      "Rp 1.500.000",
    );

    const balance = await buildReport("balance-sheet", { from: today, to: today });
    expect(balance.summary.find((item) => item.label === "Total aset")?.value.replace(/\u00a0/g, " ")).toBe(
      "Rp 1.500.000",
    );
    expect(balance.summary.find((item) => item.label === "Total ekuitas")?.value.replace(/\u00a0/g, " ")).toBe(
      "Rp 1.500.000",
    );

    const cashFlow = await buildReport("cash-flow", { from: today, to: today });
    expect(cashFlow.summary.find((item) => item.label === "Arus kas neto")?.value.replace(/\u00a0/g, " ")).toBe(
      "Rp 1.500.000",
    );
  });

  it("membalik jurnal posted dan menjaga debit-kredit tetap seimbang", async () => {
    await ensureAccountingReady(db);
    const today = getTodayDate();
    const draft = await createDraftJournal(
      {
        date: today,
        description: "Jurnal untuk dibalik",
        lines: [
          { accountKey: ACCOUNT_KEYS.CASH, debit: 750_000, credit: 0 },
          { accountKey: ACCOUNT_KEYS.SALES_REVENUE, debit: 0, credit: 750_000 },
        ],
      },
      TEST_ACTOR_ID,
    );
    const posted = await postDraftJournal(draft.id, TEST_ACTOR_ID);

    const reversal = await reverseJournal(
      posted.id,
      { date: today, reason: "Uji pembalik jurnal" },
      TEST_ACTOR_ID,
    );
    expect(reversal.status).toBe("POSTED");
    expect(reversal.reversalOfId).toBe(posted.id);

    const [original] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, posted.id))
      .limit(1);
    expect(original?.status).toBe("REVERSED");

    const trial = await buildReport("trial-balance", { from: today, to: today });
    expect(trial.summary.find((item) => item.label === "Selisih")?.value.replace(/\u00a0/g, " ")).toBe("Rp 0");
  });

  it("menolak jurnal baru pada periode yang sudah ditutup", async () => {
    await ensureAccountingReady(db);
    const today = getTodayDate();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const period = await closeFiscalPeriod(year, month, TEST_ACTOR_ID);
    expect(period.status).toBe("CLOSED");

    await expect(
      db.transaction((tx) =>
        postJournalEntry(tx, {
          date: today,
          description: "Jurnal setelah tutup buku",
          sourceType: "test",
          sourceId: crypto.randomUUID(),
          lines: [
            { accountKey: ACCOUNT_KEYS.CASH, debit: 1, credit: 0 },
            { accountKey: ACCOUNT_KEYS.SALES_REVENUE, debit: 0, credit: 1 },
          ],
          actorUserId: TEST_ACTOR_ID,
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
