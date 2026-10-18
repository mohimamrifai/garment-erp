import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { variantFormSchema } from "@/modules/master/product/schemas";
import { createVariant } from "@/modules/master/product/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.product.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, variantFormSchema);
    const variant = await createVariant(id, input, actor.id);
    return apiSuccess(variant, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
