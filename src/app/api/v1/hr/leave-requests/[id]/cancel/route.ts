import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { cancelLeaveRequest } from "@/modules/hr/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "hr.leave.approve");
    const { id } = await params;
    const leave = await cancelLeaveRequest(id, actor.id);
    return apiSuccess(leave);
  } catch (error) {
    return handleApiError(error);
  }
}
