import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { setUserBanSchema } from "@/modules/user/schemas";
import { setUserBanned } from "@/modules/user/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "user.ban");
    const { id } = await params;
    const input = await parseJsonBody(request, setUserBanSchema);
    await setUserBanned(id, input.banned, input.reason, actor.id, request.headers);
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
