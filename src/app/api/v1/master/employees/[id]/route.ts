import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateEmployeeSchema } from "@/modules/master/employee/schemas";
import { updateEmployee } from "@/modules/master/employee/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.organization.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateEmployeeSchema);
    const employee = await updateEmployee(id, input, actor.id);
    return apiSuccess(employee);
  } catch (error) {
    return handleApiError(error);
  }
}
