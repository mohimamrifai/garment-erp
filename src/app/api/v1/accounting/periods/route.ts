import { apiSuccess, handleApiError, parseJsonBody, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { z } from "zod";
import { closePeriodSchema } from "@/modules/accounting/schemas";
import { closeFiscalPeriod, listFiscalPeriods } from "@/modules/accounting/service";

const listQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "accounting.view");
    const params = parseQuery(request, listQuerySchema);
    const periods = await listFiscalPeriods(params.year);
    return apiSuccess(periods, { meta: { total: periods.length } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiPermission(request, "accounting.close");
    const input = await parseJsonBody(request, closePeriodSchema);
    const period = await closeFiscalPeriod(input.year, input.month, actor.id);
    return apiSuccess(period);
  } catch (error) {
    return handleApiError(error);
  }
}
