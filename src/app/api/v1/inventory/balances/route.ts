import { apiSuccess, handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listInventoryBalancesQuerySchema } from "@/modules/inventory/schemas";
import { listInventoryBalances } from "@/modules/inventory/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "inventory.view");
    const params = parseQuery(request, listInventoryBalancesQuerySchema);
    const { items, total, lowStockCount } = await listInventoryBalances(params);

    return apiSuccess(items, {
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
        lowStockCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
