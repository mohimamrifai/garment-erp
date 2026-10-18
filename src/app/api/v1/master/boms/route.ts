import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { bomCreateSchema, listBomsQuerySchema } from "@/modules/master/bom/schemas";
import { createBom, listBoms } from "@/modules/master/bom/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.bom.view");
    const params = parseQuery(request, listBomsQuerySchema);
    const { items, total } = await listBoms(params);

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
    const actor = await requireApiPermission(request, "master.bom.manage");
    const input = await parseJsonBody(request, bomCreateSchema);
    const bom = await createBom(input, actor.id);
    return apiSuccess(bom, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
