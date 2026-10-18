import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { departmentFormSchema, listDepartmentsQuerySchema } from "@/modules/master/department/schemas";
import { createDepartment, listDepartments } from "@/modules/master/department/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.organization.view");
    const params = parseQuery(request, listDepartmentsQuerySchema);
    const { items, total } = await listDepartments(params);

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
    const actor = await requireApiPermission(request, "master.organization.manage");
    const input = await parseJsonBody(request, departmentFormSchema);
    const department = await createDepartment(input, actor.id);
    return apiSuccess(department, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
