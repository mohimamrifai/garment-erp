import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { purchaseOrderFormSchema } from "@/modules/purchasing/schemas";
import { getPurchaseOrderDetail, updatePurchaseOrder } from "@/modules/purchasing/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "po.view");
    const { id } = await params;
    const detail = await getPurchaseOrderDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "po.update");
    const { id } = await params;
    const input = await parseJsonBody(request, purchaseOrderFormSchema);
    const order = await updatePurchaseOrder(id, input, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
