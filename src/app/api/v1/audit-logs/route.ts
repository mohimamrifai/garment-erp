import { apiSuccess, handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listAuditLogsQuerySchema } from "@/modules/audit/schemas";
import { listAuditLogs } from "@/modules/audit/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "audit.view");
    const params = parseQuery(request, listAuditLogsQuerySchema);
    const { items, total } = await listAuditLogs(params);

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
