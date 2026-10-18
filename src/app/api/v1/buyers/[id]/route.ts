import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateBuyerSchema } from "@/modules/buyer/schemas";
import { updateBuyer } from "@/modules/buyer/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "buyer.update");
    const { id } = await params;
    const input = await parseJsonBody(request, updateBuyerSchema);
    const buyer = await updateBuyer(id, input, actor.id);
    return apiSuccess(buyer);
  } catch (error) {
    return handleApiError(error);
  }
}
