import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { stageRecordSchema } from "@/modules/production/schemas";
import { recordStageOutput } from "@/modules/production/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "production.record");
    const { id } = await params;
    const input = await parseJsonBody(request, stageRecordSchema);
    const result = await recordStageOutput(id, input, actor.id);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
