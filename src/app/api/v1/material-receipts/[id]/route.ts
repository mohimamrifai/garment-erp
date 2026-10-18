import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { materialReceiptFormSchema } from "@/modules/purchasing/schemas";
import { getMaterialReceiptDetail, updateMaterialReceipt } from "@/modules/purchasing/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "receipt.view");
    const { id } = await params;
    const detail = await getMaterialReceiptDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "receipt.update");
    const { id } = await params;
    const input = await parseJsonBody(request, materialReceiptFormSchema);
    const receipt = await updateMaterialReceipt(id, input, actor.id);
    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
