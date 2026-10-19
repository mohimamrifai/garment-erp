import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelShipmentSchema } from "@/modules/shipping/schemas";
import { cancelShipment } from "@/modules/shipping/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "shipment.cancel");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelShipmentSchema);
    const shipment = await cancelShipment(id, input, actor.id);
    return apiSuccess(shipment);
  } catch (error) {
    return handleApiError(error);
  }
}
