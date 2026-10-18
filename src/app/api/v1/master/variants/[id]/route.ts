import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateVariantSchema } from "@/modules/master/product/schemas";
import { updateVariant } from "@/modules/master/product/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.product.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateVariantSchema);
    const variant = await updateVariant(id, input, actor.id);
    return apiSuccess(variant);
  } catch (error) {
    return handleApiError(error);
  }
}
