import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateMaterialSchema } from "@/modules/master/material/schemas";
import { updateMaterial } from "@/modules/master/material/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.material.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateMaterialSchema);
    const material = await updateMaterial(id, input, actor.id);
    return apiSuccess(material);
  } catch (error) {
    return handleApiError(error);
  }
}
