import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelProductionOrderSchema } from "@/modules/production/schemas";
import { cancelProductionOrder } from "@/modules/production/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "production.cancel");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelProductionOrderSchema);
    const order = await cancelProductionOrder(id, input, actor.id);
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
