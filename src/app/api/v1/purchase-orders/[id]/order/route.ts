import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { orderPurchaseOrder } from "@/modules/purchasing/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "po.order");
    const { id } = await params;
    const order = await orderPurchaseOrder(id, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
