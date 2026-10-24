import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { reverseJournalSchema } from "@/modules/accounting/schemas";
import { reverseJournal } from "@/modules/accounting/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "accounting.post");
    const { id } = await params;
    const input = await parseJsonBody(request, reverseJournalSchema);
    const journal = await reverseJournal(id, input, actor.id);
    return apiSuccess(journal);
  } catch (error) {
    return handleApiError(error);
  }
}
