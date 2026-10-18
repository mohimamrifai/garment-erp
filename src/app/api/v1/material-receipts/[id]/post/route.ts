import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { postMaterialReceipt } from "@/modules/purchasing/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "receipt.post");
    const { id } = await params;
    const receipt = await postMaterialReceipt(id, actor.id);
    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
