import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelPayrollRunSchema } from "@/modules/payroll/schemas";
import { cancelPayrollRun } from "@/modules/payroll/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "payroll.run");
    const { id } = await params;
    const input = await parseJsonBody(request, cancelPayrollRunSchema);
    const run = await cancelPayrollRun(id, input.reason, actor.id);
    return apiSuccess(run);
  } catch (error) {
    return handleApiError(error);
  }
}
