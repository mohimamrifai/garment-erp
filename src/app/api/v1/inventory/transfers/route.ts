import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { transferStockSchema } from "@/modules/inventory/schemas";
import { transferStock } from "@/modules/inventory/service";

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "inventory.move");
    const input = await parseJsonBody(request, transferStockSchema);
    const transaction = await transferStock(input, actor.id);
    return apiSuccess(transaction, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
