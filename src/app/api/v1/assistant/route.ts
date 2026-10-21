import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/auth/guards";
import { consumeAssistantQuota } from "@/modules/assistant/rate-limit";
import { assistantRequestSchema } from "@/modules/assistant/schemas";
import { askAssistant } from "@/modules/assistant/service";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const actor = await requireApiAuth(request);
    const input = await parseJsonBody(request, assistantRequestSchema);
    const quota = await consumeAssistantQuota(actor.id);
    const result = await askAssistant(input, actor);

    return apiSuccess(result, {
      meta: {
        remaining: quota.remaining,
        resetAt: quota.resetAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
