import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { postDraftJournal } from "@/modules/accounting/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "accounting.post");
    const { id } = await params;
    const journal = await postDraftJournal(id, actor.id);
    return apiSuccess(journal);
  } catch (error) {
    return handleApiError(error);
  }
}
