import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { payPayrollRunSchema } from "@/modules/payroll/schemas";
import { payPayrollRun } from "@/modules/payroll/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "payroll.pay");
    const { id } = await params;
    const input = await parseJsonBody(request, payPayrollRunSchema);
    const run = await payPayrollRun(id, input, actor.id);
    return apiSuccess(run);
  } catch (error) {
    return handleApiError(error);
  }
}
