import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listUomsQuerySchema, uomFormSchema } from "@/modules/master/uom/schemas";
import { createUom, listUoms } from "@/modules/master/uom/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.uom.view");
    const params = parseQuery(request, listUomsQuerySchema);
    const { items, total } = await listUoms(params);

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
    const actor = await requireApiPermission(request, "master.uom.manage");
    const input = await parseJsonBody(request, uomFormSchema);
    const uom = await createUom(input, actor.id);
    return apiSuccess(uom, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
