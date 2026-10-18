import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateWarehouseSchema } from "@/modules/master/warehouse/schemas";
import { updateWarehouse } from "@/modules/master/warehouse/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.warehouse.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateWarehouseSchema);
    const warehouse = await updateWarehouse(id, input, actor.id);
    return apiSuccess(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}
