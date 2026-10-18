import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateUserSchema } from "@/modules/user/schemas";
import { updateUserName } from "@/modules/user/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "user.update");
    const { id } = await params;
    const input = await parseJsonBody(request, updateUserSchema);
    await updateUserName(id, input.name, actor.id);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
