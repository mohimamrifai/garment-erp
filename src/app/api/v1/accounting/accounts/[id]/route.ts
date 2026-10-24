import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateAccountSchema } from "@/modules/accounting/schemas";
import { updateAccount } from "@/modules/accounting/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "accounting.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateAccountSchema);
    const account = await updateAccount(id, input, actor.id);
    return apiSuccess(account);
  } catch (error) {
    return handleApiError(error);
  }
}
