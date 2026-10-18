import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { setUserPasswordSchema } from "@/modules/user/schemas";
import { setUserPassword } from "@/modules/user/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "user.set_password");
    const { id } = await params;
    const input = await parseJsonBody(request, setUserPasswordSchema);
    await setUserPassword(id, input.newPassword, actor.id, request.headers);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
