import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { leaveDecisionSchema } from "@/modules/hr/schemas";
import { rejectLeaveRequest } from "@/modules/hr/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "hr.leave.approve");
    const { id } = await params;
    const input = await parseJsonBody(request, leaveDecisionSchema);
    const leave = await rejectLeaveRequest(
      id,
      input.reason?.trim() || "Tidak memenuhi ketentuan.",
      actor.id,
    );
    return apiSuccess(leave);
  } catch (error) {
    return handleApiError(error);
  }
}
