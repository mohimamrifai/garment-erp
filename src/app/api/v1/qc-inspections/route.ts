import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { createQcInspectionSchema, listQcInspectionsQuerySchema } from "@/modules/qc/schemas";
import { createQcInspection, listQcInspections } from "@/modules/qc/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "qc.view");
    const params = parseQuery(request, listQcInspectionsQuerySchema);
    const { items, total } = await listQcInspections(params);

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
    const actor = await requireApiPermission(request, "qc.inspect");
    const input = await parseJsonBody(request, createQcInspectionSchema);
    const inspection = await createQcInspection(input, actor.id);
    return apiSuccess(inspection, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
