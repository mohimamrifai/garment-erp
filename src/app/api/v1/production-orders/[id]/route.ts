import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { getProductionOrderDetail } from "@/modules/production/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "production.view");
    const { id } = await params;
    const detail = await getProductionOrderDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
