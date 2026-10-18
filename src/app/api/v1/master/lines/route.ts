import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import {
  lineFormSchema,
  listLinesQuerySchema,
} from "@/modules/master/production-line/schemas";
import { createLine, listLines } from "@/modules/master/production-line/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.organization.view");
    const params = parseQuery(request, listLinesQuerySchema);
    const { items, total } = await listLines(params);

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
    const actor = await requireApiPermission(request, "master.organization.manage");
    const input = await parseJsonBody(request, lineFormSchema);
    const line = await createLine(input, actor.id);
    return apiSuccess(line, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
