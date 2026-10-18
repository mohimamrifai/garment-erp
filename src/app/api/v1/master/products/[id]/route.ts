import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateProductSchema } from "@/modules/master/product/schemas";
import { updateProduct } from "@/modules/master/product/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.product.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateProductSchema);
    const product = await updateProduct(id, input, actor.id);
    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error);
  }
}
