import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { journalFormSchema, listJournalsQuerySchema } from "@/modules/accounting/schemas";
import { createDraftJournal, listJournals } from "@/modules/accounting/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const params = parseQuery(request, listJournalsQuerySchema);
    const { items, total } = await listJournals(params);
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
    const actor = await requireApiPermission(request, "accounting.manage");
    const input = await parseJsonBody(request, journalFormSchema);
    const journal = await createDraftJournal(input, actor.id);
    return apiSuccess(journal, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
