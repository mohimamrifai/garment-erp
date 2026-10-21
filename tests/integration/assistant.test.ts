import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { assistantUsage } from "@/lib/db/schema";
import {
  ASSISTANT_RATE_LIMIT,
  ASSISTANT_RATE_WINDOW_MS,
  consumeAssistantQuota,
} from "@/modules/assistant/rate-limit";
import { TEST_ACTOR_ID } from "../helpers/constants";

beforeEach(async () => {
  await db.delete(assistantUsage);
});

describe("kuota Asisten AI (integrasi DB)", () => {
  it("mengizinkan 20 request lalu menolak request berikutnya", async () => {
    for (let request = 1; request <= ASSISTANT_RATE_LIMIT; request += 1) {
      const quota = await consumeAssistantQuota(TEST_ACTOR_ID);
      expect(quota.remaining).toBe(ASSISTANT_RATE_LIMIT - request);
      expect(quota.resetAt.getTime()).toBeGreaterThan(Date.now());
    }

    await expect(consumeAssistantQuota(TEST_ACTOR_ID)).rejects.toMatchObject({
      status: 429,
      code: "ASSISTANT_RATE_LIMITED",
    });
  });

  it("membuka kuota baru setelah jendela satu jam berakhir", async () => {
    await db.insert(assistantUsage).values({
      userId: TEST_ACTOR_ID,
      windowStartedAt: new Date(Date.now() - ASSISTANT_RATE_WINDOW_MS - 1_000),
      requestCount: ASSISTANT_RATE_LIMIT,
    });

    const quota = await consumeAssistantQuota(TEST_ACTOR_ID);
    expect(quota.remaining).toBe(ASSISTANT_RATE_LIMIT - 1);
  });
});
