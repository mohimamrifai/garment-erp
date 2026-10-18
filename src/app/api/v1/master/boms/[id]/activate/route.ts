import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { activateBom } from "@/modules/master/bom/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "master.bom.manage");
    const { id } = await params;
    const bom = await activateBom(id, actor.id);
    return apiSuccess(bom);
  } catch (error) {
    return handleApiError(error);
  }
}
