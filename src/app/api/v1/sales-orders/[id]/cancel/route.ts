import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelSalesOrderSchema } from "@/modules/sales-order/schemas";
import { cancelSalesOrder } from "@/modules/sales-order/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "so.cancel");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelSalesOrderSchema);
    const order = await cancelSalesOrder(id, input, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
