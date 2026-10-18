import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateUomSchema } from "@/modules/master/uom/schemas";
import { updateUom } from "@/modules/master/uom/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.uom.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateUomSchema);
    const uom = await updateUom(id, input, actor.id);
    return apiSuccess(uom);
  } catch (error) {
    return handleApiError(error);
  }
}
