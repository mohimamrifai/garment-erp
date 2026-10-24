import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import {
  attendanceFormSchema,
  listAttendanceQuerySchema,
} from "@/modules/hr/schemas";
import { createAttendance, listAttendance } from "@/modules/hr/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "hr.attendance.view");
    const params = parseQuery(request, listAttendanceQuerySchema);
    const { items, total } = await listAttendance(params);
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
    const actor = await requireApiPermission(request, "hr.attendance.manage");
    const input = await parseJsonBody(request, attendanceFormSchema);
    const record = await createAttendance(input, actor.id);
    return apiSuccess(record, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
