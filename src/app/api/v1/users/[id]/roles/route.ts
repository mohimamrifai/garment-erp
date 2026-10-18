import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { setUserRolesSchema } from "@/modules/user/schemas";
import { setUserRoles } from "@/modules/user/service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "user.assign_roles");
    const { id } = await params;
    const input = await parseJsonBody(request, setUserRolesSchema);
    await setUserRoles(id, input.roleCodes, actor.id, request.headers);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
