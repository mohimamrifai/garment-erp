import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { getSalesOrderFulfillment } from "@/modules/shipping/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "so.view");
    const { id } = await params;
    const fulfillment = await getSalesOrderFulfillment(id);
    return apiSuccess(fulfillment);
  } catch (error) {
    return handleApiError(error);
  }
}
