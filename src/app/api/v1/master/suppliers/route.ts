import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { listSuppliersQuerySchema, supplierFormSchema } from "@/modules/master/supplier/schemas";
import { createSupplier, listSuppliers } from "@/modules/master/supplier/service";

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "master.supplier.view");
    const params = parseQuery(request, listSuppliersQuerySchema);
    const { items, total } = await listSuppliers(params);

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
    const actor = await requireApiPermission(request, "master.supplier.manage");
    const input = await parseJsonBody(request, supplierFormSchema);
    const supplier = await createSupplier(input, actor.id);
    return apiSuccess(supplier, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
