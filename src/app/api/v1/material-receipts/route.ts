import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import {
  listMaterialReceiptsQuerySchema,
  materialReceiptFormSchema,
} from "@/modules/purchasing/schemas";
import { createMaterialReceipt, listMaterialReceipts } from "@/modules/purchasing/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "receipt.view");
    const params = parseQuery(request, listMaterialReceiptsQuerySchema);
    const { items, total } = await listMaterialReceipts(params);

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
    const actor = await requireApiPermission(request, "receipt.create");
    const input = await parseJsonBody(request, materialReceiptFormSchema);
    const receipt = await createMaterialReceipt(input, actor.id);
    return apiSuccess(receipt, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
