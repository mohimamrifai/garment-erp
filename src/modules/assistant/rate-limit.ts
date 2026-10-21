import { sql } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { assistantUsage } from "@/lib/db/schema";

export const ASSISTANT_RATE_LIMIT = 20;
export const ASSISTANT_RATE_WINDOW_MS = 60 * 60 * 1000;

export type AssistantQuota = {
  remaining: number;
  resetAt: Date;
};

/**
 * Hitung satu request ke kuota user secara atomik.
 *
 * UPSERT ini aman untuk request bersamaan: Postgres mengunci baris yang
 * bentrok, sehingga dua request tidak bisa sama-sama membaca hitungan lama.
 * Jendela waktu memakai sliding fixed window per jam.
 */
export async function consumeAssistantQuota(userId: string): Promise<AssistantQuota> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ASSISTANT_RATE_WINDOW_MS);
  // Parameter di dalam `sql` mentah harus berupa string + cast eksplisit;
  // driver postgres-js tidak menerima instance Date untuk placeholder ini.
  const nowIso = now.toISOString();
  const windowStartIso = windowStart.toISOString();

  const [row] = await db
    .insert(assistantUsage)
    .values({
      userId,
      windowStartedAt: now,
      requestCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: assistantUsage.userId,
      set: {
        requestCount: sql`case
          when ${assistantUsage.windowStartedAt} <= ${windowStartIso}::timestamptz then 1
          else ${assistantUsage.requestCount} + 1
        end`,
        windowStartedAt: sql`case
          when ${assistantUsage.windowStartedAt} <= ${windowStartIso}::timestamptz then ${nowIso}::timestamptz
          else ${assistantUsage.windowStartedAt}
        end`,
        updatedAt: now,
      },
    })
    .returning();

  if (!row) {
    throw new ApiError(500, "ASSISTANT_QUOTA_ERROR", "Gagal memeriksa kuota Asisten AI.");
  }

  const resetAt = new Date(row.windowStartedAt.getTime() + ASSISTANT_RATE_WINDOW_MS);
  if (row.requestCount > ASSISTANT_RATE_LIMIT) {
    throw new ApiError(
      429,
      "ASSISTANT_RATE_LIMITED",
      `Batas ${ASSISTANT_RATE_LIMIT} pesan per jam tercapai. Coba lagi setelah ${resetAt.toLocaleTimeString(
        "id-ID",
        { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" },
      )} WIB.`,
      { resetAt: resetAt.toISOString() },
    );
  }

  return {
    remaining: Math.max(0, ASSISTANT_RATE_LIMIT - row.requestCount),
    resetAt,
  };
}
