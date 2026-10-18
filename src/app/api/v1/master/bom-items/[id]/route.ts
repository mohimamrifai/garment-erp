import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { removeBomItem } from "@/modules/master/bom/service";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.bom.manage");
    const { id } = await params;
    await removeBomItem(id, actor.id);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
