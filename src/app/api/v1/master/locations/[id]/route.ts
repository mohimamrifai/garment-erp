import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateLocationSchema } from "@/modules/master/warehouse/schemas";
import { updateLocation } from "@/modules/master/warehouse/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.warehouse.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateLocationSchema);
    const location = await updateLocation(id, input, actor.id);
    return apiSuccess(location);
  } catch (error) {
    return handleApiError(error);
  }
}
