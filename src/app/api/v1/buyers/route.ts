import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { buyerFormSchema, listBuyersQuerySchema } from "@/modules/buyer/schemas";
import { createBuyer, listBuyers } from "@/modules/buyer/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "buyer.view");
    const params = parseQuery(request, listBuyersQuerySchema);
    const { items, total } = await listBuyers(params);

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
    const actor = await requireApiPermission(request, "buyer.create");
    const input = await parseJsonBody(request, buyerFormSchema);
    const buyer = await createBuyer(input, actor.id);
    return apiSuccess(buyer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
