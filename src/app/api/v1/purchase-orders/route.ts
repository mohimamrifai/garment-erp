import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listPurchaseOrdersQuerySchema, purchaseOrderFormSchema } from "@/modules/purchasing/schemas";
import { createPurchaseOrder, listPurchaseOrders } from "@/modules/purchasing/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "po.view");
    const params = parseQuery(request, listPurchaseOrdersQuerySchema);
    const { items, total } = await listPurchaseOrders(params);

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
    const actor = await requireApiPermission(request, "po.create");
    const input = await parseJsonBody(request, purchaseOrderFormSchema);
    const order = await createPurchaseOrder(input, actor.id);
    return apiSuccess(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
