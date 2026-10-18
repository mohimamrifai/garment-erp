import { apiSuccess, handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { productionPlanningPreviewQuerySchema } from "@/modules/production/schemas";
import { getPlanningPreview } from "@/modules/production/service";

/** Pratinjau ketersediaan material (gate sebelum SPK, FR-07/FR-08). */
export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "production.view");
    const params = parseQuery(request, productionPlanningPreviewQuerySchema);
    const preview = await getPlanningPreview({
      salesOrderItemId: params.soItem,
      quantity: params.quantity,
      needBy: params.needBy ? params.needBy : null,
    });
    return apiSuccess(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
