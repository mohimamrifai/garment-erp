import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { updateSupplierSchema } from "@/modules/master/supplier/schemas";
import { updateSupplier } from "@/modules/master/supplier/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.supplier.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, updateSupplierSchema);
    const supplier = await updateSupplier(id, input, actor.id);
    return apiSuccess(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}
