import { ApiError } from "@/lib/api/errors";
import { handleApiError, parseQuery } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/auth/guards";
import { reportExportQuerySchema } from "@/modules/reports/schemas";
import { reportFileName, toCsv } from "@/modules/reports/csv";
import { buildReport, canAccessReport, getReportDefinition } from "@/modules/reports/service";

/** Ekspor CSV laporan (F5 task 5.7) — isi mengikuti kolom laporan di layar. */
export async function GET(request: Request) {
  try {
    const actor = await requireApiPermission(request, "report.view");
    const params = parseQuery(request, reportExportQuerySchema);
    const definition = getReportDefinition(params.report);
    if (!canAccessReport(actor.roles, definition)) throw ApiError.forbidden();

    const report = await buildReport(params.report, { from: params.from, to: params.to });
    const csv = toCsv(report.definition.columns, report.rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFileName(params.report, report.from, report.to)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
