import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateLineSchema } from "@/modules/master/production-line/schemas";
import { updateLine } from "@/modules/master/production-line/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.organization.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateLineSchema);
    const line = await updateLine(id, input, actor.id);
    return apiSuccess(line);
  } catch (error) {
    return handleApiError(error);
  }
}
