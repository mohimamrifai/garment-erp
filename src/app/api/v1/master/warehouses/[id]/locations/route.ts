import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { locationFormSchema } from "@/modules/master/warehouse/schemas";
import { createLocation } from "@/modules/master/warehouse/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.warehouse.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, locationFormSchema);
    const location = await createLocation(id, input, actor.id);
    return apiSuccess(location, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
