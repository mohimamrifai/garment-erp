import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { approvePayrollRun } from "@/modules/payroll/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "payroll.approve");
    const { id } = await params;
    const run = await approvePayrollRun(id, actor.id);
    return apiSuccess(run);
  } catch (error) {
    return handleApiError(error);
  }
}
