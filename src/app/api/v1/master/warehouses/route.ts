import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listWarehousesQuerySchema, warehouseFormSchema } from "@/modules/master/warehouse/schemas";
import { createWarehouse, listWarehouses } from "@/modules/master/warehouse/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.warehouse.view");
    const params = parseQuery(request, listWarehousesQuerySchema);
    const { items, total } = await listWarehouses(params);

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
    const actor = await requireApiPermission(request, "master.warehouse.manage");
    const input = await parseJsonBody(request, warehouseFormSchema);
    const warehouse = await createWarehouse(input, actor.id);
    return apiSuccess(warehouse, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
