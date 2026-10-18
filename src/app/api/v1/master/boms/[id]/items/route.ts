import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { bomItemFormSchema } from "@/modules/master/bom/schemas";
import { addBomItem } from "@/modules/master/bom/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.bom.manage");
    const { id } = await params;
    const input = await parseJsonBody(request, bomItemFormSchema);
    await addBomItem(id, input, actor.id);
    return apiSuccess({ bomId: id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
