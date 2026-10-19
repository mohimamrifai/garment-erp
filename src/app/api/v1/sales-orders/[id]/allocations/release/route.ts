import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { releaseAllocationSchema } from "@/modules/shipping/schemas";
import { releaseAllocation } from "@/modules/shipping/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "fg.allocate");
    const { id } = await params;
    const input = await parseJsonBody(request, releaseAllocationSchema);
    const result = await releaseAllocation(id, input, actor.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
