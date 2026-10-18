import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { salesOrderFormSchema } from "@/modules/sales-order/schemas";
import { getSalesOrderDetail, updateSalesOrder } from "@/modules/sales-order/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "so.view");
    const { id } = await params;
    const detail = await getSalesOrderDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "so.update");
    const { id } = await params;
    const input = await parseJsonBody(request, salesOrderFormSchema);
    const order = await updateSalesOrder(id, input, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
