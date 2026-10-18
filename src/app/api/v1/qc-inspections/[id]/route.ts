import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { getQcInspectionDetail } from "@/modules/qc/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "qc.view");
    const { id } = await params;
    const detail = await getQcInspectionDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
