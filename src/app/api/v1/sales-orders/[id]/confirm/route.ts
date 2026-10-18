import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { confirmSalesOrder } from "@/modules/sales-order/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "so.confirm");
    const { id } = await params;
    const order = await confirmSalesOrder(id, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
