import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import {
  createProductionOrderSchema,
  listProductionOrdersQuerySchema,
} from "@/modules/production/schemas";
import { createProductionOrder, listProductionOrders } from "@/modules/production/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "production.view");
    const params = parseQuery(request, listProductionOrdersQuerySchema);
    const { items, total } = await listProductionOrders(params);

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
    const actor = await requireApiPermission(request, "production.create");
    const input = await parseJsonBody(request, createProductionOrderSchema);
    const order = await createProductionOrder(input, actor.id);
    return apiSuccess(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
