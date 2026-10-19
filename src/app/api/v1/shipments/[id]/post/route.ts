import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { postShipment } from "@/modules/shipping/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "shipment.post");
    const { id } = await params;
    const shipment = await postShipment(id, actor.id);
    return apiSuccess(shipment);
  } catch (error) {
    return handleApiError(error);
  }
}
