import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { createShipmentSchema, listShipmentsQuerySchema } from "@/modules/shipping/schemas";
import { createShipment, listShipments } from "@/modules/shipping/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "shipment.view");
    const params = parseQuery(request, listShipmentsQuerySchema);
    const { items, total } = await listShipments(params);

    return apiSuccess(items, {
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "shipment.create");
    const input = await parseJsonBody(request, createShipmentSchema);
    const shipment = await createShipment(input, actor.id);
    return apiSuccess(shipment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
