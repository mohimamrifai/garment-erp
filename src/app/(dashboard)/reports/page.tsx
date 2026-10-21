import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateId } from "@/lib/utils/dates";
import { ReportTable } from "@/modules/reports/components/report-table";
import { reportQuerySchema } from "@/modules/reports/schemas";
import {
  buildReport,
  listReportsForRoles,
  resolveReportPeriod,
  type ReportDefinition,
} from "@/modules/reports/service";

export const metadata: Metadata = { title: "Laporan" };

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan"
        description="Laporan operasional dengan filter periode dan ekspor CSV — akses mengikuti role Anda."
      />
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full max-w-2xl" />
      <Skeleton className="h-12 w-full" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function ReportsSection({ searchParams }: ReportsPageProps) {
  const actor = await requirePagePermission("report.view");
  const params = await searchParams;
  const available = listReportsForRoles(actor.roles);

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum ada laporan untuk role Anda</CardTitle>
          <CardDescription>
            Hubungi administrator bila Anda memerlukan akses laporan tertentu.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const parsed = reportQuerySchema.safeParse({
    report: typeof params.report === "string" ? params.report : undefined,
    from: typeof params.from === "string" ? params.from : "",
    to: typeof params.to === "string" ? params.to : "",
  });
  const fromInput = parsed.success ? parsed.data.from : "";
  const toInput = parsed.success ? parsed.data.to : "";

  const requestedSlug = typeof params.report === "string" ? params.report : undefined;
  const selected = available.find((report) => report.slug === requestedSlug) ?? available[0]!;

  let report;
  let periodError: string | null = null;
  try {
    report = await buildReport(selected.slug, {
      from: isIsoDate(fromInput) ? fromInput : undefined,
      to: isIsoDate(toInput) ? toInput : undefined,
    });
  } catch (error) {
    periodError =
      error instanceof ApiError ? error.message : "Gagal menyusun laporan pada periode ini.";
    const fallback = resolveReportPeriod({});
    report = {
      definition: selected,
      from: fallback.from,
      to: fallback.to,
      rows: [],
      summary: [],
    };
  }

  const exportParams = new URLSearchParams({
    report: selected.slug,
    from: report.from,
    to: report.to,
  });

  return (
    <div className="flex flex-col gap-4">
      <ReportTabs
        reports={available}
        selected={selected}
        from={report.from}
        to={report.to}
      />

      <form
        action="/reports"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
      >
        <input type="hidden" name="report" value={selected.slug} />
        <div className="flex flex-col gap-1">
          <label htmlFor="report-from" className="text-[11px] text-muted-foreground">
            Dari tanggal
          </label>
          <Input
            id="report-from"
            type="date"
            name="from"
            defaultValue={report.from}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="report-to" className="text-[11px] text-muted-foreground">
            Sampai tanggal
          </label>
          <Input id="report-to" type="date" name="to" defaultValue={report.to} className="w-40" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Terapkan
        </Button>
        <div className="grow" />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/api/v1/reports/export?${exportParams.toString()}`} download />}
        >
          <Download data-icon="inline-start" />
          Ekspor CSV
        </Button>
      </form>

      {periodError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-[13px] text-destructive">
          {periodError}
        </p>
      ) : null}

      {report.summary.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {report.summary.map((item) => (
            <Card key={item.label} size="sm">
              <CardHeader className="flex flex-col gap-0.5">
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="font-mono text-xl tabular-nums">{item.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle>{selected.title}</CardTitle>
              <CardDescription>{selected.description}</CardDescription>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {formatDateId(report.from)} – {formatDateId(report.to)} · {report.rows.length} baris
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable columns={selected.columns} rows={report.rows} />
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FileBarChart className="size-3.5" aria-hidden />
        Ekspor CSV memakai kolom yang sama dengan tabel di layar.
      </p>
    </div>
  );
}

function ReportTabs({
  reports,
  selected,
  from,
  to,
}: {
  reports: readonly ReportDefinition[];
  selected: ReportDefinition;
  from: string;
  to: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {reports.map((report) => {
        const active = report.slug === selected.slug;
        const params = new URLSearchParams({ report: report.slug, from, to });
        return (
          <Button
            key={report.slug}
            size="sm"
            variant={active ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={`/reports?${params.toString()}`} />}
          >
            {report.title}
          </Button>
        );
      })}
    </div>
  );
}
