import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { createPayrollRunSchema, listPayrollRunsQuerySchema } from "@/modules/payroll/schemas";
import { createPayrollRun, listPayrollRuns } from "@/modules/payroll/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "payroll.view");
    const params = parseQuery(request, listPayrollRunsQuerySchema);
    const { items, total } = await listPayrollRuns(params);
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
    const actor = await requireApiPermission(request, "payroll.run");
    const input = await parseJsonBody(request, createPayrollRunSchema);
    const run = await createPayrollRun(input, actor.id);
    return apiSuccess(run, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
