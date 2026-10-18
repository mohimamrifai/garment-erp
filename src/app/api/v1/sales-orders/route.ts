import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listSalesOrdersQuerySchema, salesOrderFormSchema } from "@/modules/sales-order/schemas";
import { createSalesOrder, listSalesOrders } from "@/modules/sales-order/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "so.view");
    const params = parseQuery(request, listSalesOrdersQuerySchema);
    const { items, total } = await listSalesOrders(params);

    return apiSuccess(items, {
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "so.create");
    const input = await parseJsonBody(request, salesOrderFormSchema);
    const order = await createSalesOrder(input, actor.id);
    return apiSuccess(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
