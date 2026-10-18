import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelPurchaseOrderSchema } from "@/modules/purchasing/schemas";
import { cancelPurchaseOrder } from "@/modules/purchasing/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "po.cancel");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelPurchaseOrderSchema);
    const order = await cancelPurchaseOrder(id, input, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
