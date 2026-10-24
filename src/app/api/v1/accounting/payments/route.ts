import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listPaymentsQuerySchema, paymentFormSchema } from "@/modules/accounting/schemas";
import { createPayment, listPayments } from "@/modules/accounting/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const params = parseQuery(request, listPaymentsQuerySchema);
    const { items, total } = await listPayments(params);
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
    const actor = await requireApiPermission(request, "accounting.pay");
    const input = await parseJsonBody(request, paymentFormSchema);
    const payment = await createPayment(input, actor.id);
    return apiSuccess(payment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
