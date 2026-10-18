import { sql } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db";
import { documentSequences } from "@/lib/db/schema";
import { getDocumentPeriod } from "./dates";

/**
 * Ambil nomor dokumen berikutnya secara atomik (aman untuk request bersamaan).
 * WAJIB dipanggil di dalam transaksi yang sama dengan pembuatan dokumen.
 *
 * Format:
 * - Dengan periode (dokumen bulanan): `SO-202610-0001`
 * - Tanpa periode (counter global):   `BUY-0001`
 *
 * Ketika `period` tidak diberikan, periode bulan berjalan (Asia/Jakarta)
 * dipakai otomatis.
 */
export async function nextDocumentNumber(
  tx: DbExecutor,
  prefix: string,
  options: { period?: string | null; pad?: number } = {},
): Promise<string> {
  const pad = options.pad ?? 4;
  const period = options.period === undefined ? getDocumentPeriod() : options.period;
  const scope = period ?? "GLOBAL";

  const [row] = await tx
    .insert(documentSequences)
    .values({ prefix, period: scope, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequences.prefix, documentSequences.period],
      set: {
        lastNumber: sql`${documentSequences.lastNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastNumber: documentSequences.lastNumber });

  const sequence = String(row.lastNumber).padStart(pad, "0");
  return period ? `${prefix}-${period}-${sequence}` : `${prefix}-${sequence}`;
}
