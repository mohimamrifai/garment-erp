import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { getJournalDetail } from "@/modules/accounting/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "accounting.view");
    const { id } = await params;
    const detail = await getJournalDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
