import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelMaterialReceiptSchema } from "@/modules/purchasing/schemas";
import { cancelMaterialReceipt } from "@/modules/purchasing/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "receipt.cancel");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelMaterialReceiptSchema);
    const receipt = await cancelMaterialReceipt(id, input, actor.id);
    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
