import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { accountFormSchema, listAccountsQuerySchema } from "@/modules/accounting/schemas";
import { createAccount, listAccounts } from "@/modules/accounting/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const params = parseQuery(request, listAccountsQuerySchema);
    const { items, total } = await listAccounts(params);
    return apiSuccess(items, { meta: { total } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "accounting.manage");
    const input = await parseJsonBody(request, accountFormSchema);
    const account = await createAccount(input, actor.id);
    return apiSuccess(account, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
