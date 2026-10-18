import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listMaterialsQuerySchema, materialFormSchema } from "@/modules/master/material/schemas";
import { createMaterial, listMaterials } from "@/modules/master/material/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.material.view");
    const params = parseQuery(request, listMaterialsQuerySchema);
    const { items, total } = await listMaterials(params);

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
    const actor = await requireApiPermission(request, "master.material.manage");
    const input = await parseJsonBody(request, materialFormSchema);
    const material = await createMaterial(input, actor.id);
    return apiSuccess(material, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
