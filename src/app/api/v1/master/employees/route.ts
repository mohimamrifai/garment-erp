import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { employeeFormSchema, listEmployeesQuerySchema } from "@/modules/master/employee/schemas";
import { createEmployee, listEmployees } from "@/modules/master/employee/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.organization.view");
    const params = parseQuery(request, listEmployeesQuerySchema);
    const { items, total } = await listEmployees(params);

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
    const input = await parseJsonBody(request, employeeFormSchema);
    const employee = await createEmployee(input, actor.id);
    return apiSuccess(employee, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
