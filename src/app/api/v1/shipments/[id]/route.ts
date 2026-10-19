import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { getShipmentDetail } from "@/modules/shipping/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "shipment.view");
    const { id } = await params;
    const shipment = await getShipmentDetail(id);
    return apiSuccess(shipment);
  } catch (error) {
    return handleApiError(error);
  }
}
