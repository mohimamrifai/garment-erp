import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { createUserSchema, listUsersQuerySchema } from "@/modules/user/schemas";
import { createUser, listUsers } from "@/modules/user/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "user.view");
    const params = parseQuery(request, listUsersQuerySchema);
    const { items, total } = await listUsers(params);

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
    const actor = await requireApiPermission(request, "user.create");
    const input = await parseJsonBody(request, createUserSchema);
    const user = await createUser(input, actor.id, request.headers);
    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
