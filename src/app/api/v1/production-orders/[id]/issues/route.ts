import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { materialIssueSchema } from "@/modules/production/schemas";
import { issueMaterials } from "@/modules/production/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiPermission(request, "production.issue");
    const { id } = await params;
    const input = await parseJsonBody(request, materialIssueSchema);
    const issue = await issueMaterials(id, input, actor.id);
    return apiSuccess(issue, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
