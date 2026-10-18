import { apiSuccess, handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listInventoryTransactionsQuerySchema } from "@/modules/inventory/schemas";
import { listInventoryTransactions } from "@/modules/inventory/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "inventory.view");
    const params = parseQuery(request, listInventoryTransactionsQuerySchema);
    const { items, total } = await listInventoryTransactions(params);

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
