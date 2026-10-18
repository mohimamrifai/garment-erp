import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { adjustStockSchema } from "@/modules/inventory/schemas";
import { adjustStock } from "@/modules/inventory/service";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "inventory.adjust");
    const input = await parseJsonBody(request, adjustStockSchema);
    const transaction = await adjustStock(input, actor.id);
    return apiSuccess(transaction, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
