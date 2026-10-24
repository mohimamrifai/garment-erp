import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateAttendanceSchema } from "@/modules/hr/schemas";
import { deleteAttendance, updateAttendance } from "@/modules/hr/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "hr.attendance.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateAttendanceSchema);
    const record = await updateAttendance(id, input, actor.id);
    return apiSuccess(record);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "hr.attendance.manage");
    const { id } = await params;
    await deleteAttendance(id, actor.id);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
