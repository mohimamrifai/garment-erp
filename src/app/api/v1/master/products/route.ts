import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listProductsQuerySchema, productFormSchema } from "@/modules/master/product/schemas";
import { createProduct, listProducts } from "@/modules/master/product/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.product.view");
    const params = parseQuery(request, listProductsQuerySchema);
    const { items, total } = await listProducts(params);

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
    const actor = await requireApiPermission(request, "master.product.manage");
    const input = await parseJsonBody(request, productFormSchema);
    const product = await createProduct(input, actor.id);
    return apiSuccess(product, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
