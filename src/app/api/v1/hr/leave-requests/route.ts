import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { leaveRequestFormSchema, listLeaveQuerySchema } from "@/modules/hr/schemas";
import { createLeaveRequest, listLeaveRequests } from "@/modules/hr/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "hr.leave.view");
    const params = parseQuery(request, listLeaveQuerySchema);
    const { items, total } = await listLeaveRequests(params);
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
    const actor = await requireApiPermission(request, "hr.leave.request");
    const input = await parseJsonBody(request, leaveRequestFormSchema);
    const leave = await createLeaveRequest(input, actor.id);
    return apiSuccess(leave, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
