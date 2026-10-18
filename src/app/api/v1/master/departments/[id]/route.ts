import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateDepartmentSchema } from "@/modules/master/department/schemas";
import { updateDepartment } from "@/modules/master/department/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.organization.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateDepartmentSchema);
    const department = await updateDepartment(id, input, actor.id);
    return apiSuccess(department);
  } catch (error) {
    return handleApiError(error);
  }
}
