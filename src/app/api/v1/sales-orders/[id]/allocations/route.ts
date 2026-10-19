import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { createAllocationSchema } from "@/modules/shipping/schemas";
import { createAllocation } from "@/modules/shipping/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "fg.allocate");
    const { id } = await params;
    const input = await parseJsonBody(request, createAllocationSchema);
    const result = await createAllocation(id, input, actor.id);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
