import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { QcInspectionsTable } from "@/modules/qc/components/qc-inspections-table";
import { listQcInspectionsQuerySchema } from "@/modules/qc/schemas";
import { listQcInspections } from "@/modules/qc/service";
import { QC_RESULT_LABELS, STAGE_CODE_LABELS } from "@/modules/production/status";

export const metadata: Metadata = { title: "Quality Control" };

type QcPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function QcPage({ searchParams }: QcPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quality Control"
        description="Inspeksi kualitas per tahap produksi: hasil lolos, rework, atau gagal beserta rincian cacat."
      />
      <Suspense fallback={<QcSectionSkeleton />}>
        <QcSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function QcSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function QcSection({ searchParams }: QcPageProps) {
  const actor = await requirePagePermission("qc.view");
  const params = await searchParams;

  const parsed = listQcInspectionsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    result: params.result,
    stage: params.stage,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listQcInspectionsQuerySchema.parse({});

  const { items, total } = await listQcInspections(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  const resultOptions = (
    Object.keys(QC_RESULT_LABELS) as (keyof typeof QC_RESULT_LABELS)[]
  ).map((result) => ({ value: result, label: QC_RESULT_LABELS[result] }));
  const stageOptions = (Object.keys(STAGE_CODE_LABELS) as (keyof typeof STAGE_CODE_LABELS)[]).map(
    (stage) => ({ value: stage, label: STAGE_CODE_LABELS[stage] }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor inspeksi, SPK, atau produk..."
          ariaLabel="Cari inspeksi QC"
          status={listParams.result}
          hideStatus
          filters={[
            {
              key: "result",
              value: listParams.result,
              allLabel: "Semua hasil",
              options: resultOptions,
              widthClass: "w-44",
              "aria-label": "Filter hasil inspeksi",
            },
            {
              key: "stage",
              value: listParams.stage,
              allLabel: "Semua tahap",
              options: stageOptions,
              widthClass: "w-36",
              "aria-label": "Filter tahap produksi",
            },
          ]}
        />
        {can(actor.roles, "qc.inspect") ? (
          <Button render={<Link href="/qc/new" />}>
            <Plus data-icon="inline-start" />
            Inspeksi Baru
          </Button>
        ) : null}
      </div>

      <QcInspectionsTable inspections={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} inspeksi terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
