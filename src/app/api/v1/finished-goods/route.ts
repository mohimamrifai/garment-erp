import { apiSuccess, handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listFinishedGoodsQuerySchema } from "@/modules/finished-goods/schemas";
import { listFinishedGoodsStock } from "@/modules/finished-goods/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "fg.view");
    const params = parseQuery(request, listFinishedGoodsQuerySchema);
    const { items, total, totals } = await listFinishedGoodsStock(params);

    return apiSuccess(items, {
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
        totals,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
