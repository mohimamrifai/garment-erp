import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateLineButton } from "@/modules/master/production-line/components/line-form-dialog";
import { LinesTable } from "@/modules/master/production-line/components/lines-table";
import { listLinesQuerySchema } from "@/modules/master/production-line/schemas";
import { listLines } from "@/modules/master/production-line/service";

export const metadata: Metadata = { title: "Lini Produksi" };

type LinesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function LinesPage({ searchParams }: LinesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lini Produksi"
        description="Lini produksi yang dipakai saat membuat SPK."
      />
      <Suspense fallback={<LinesSectionSkeleton />}>
        <LinesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function LinesSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function LinesSection({ searchParams }: LinesPageProps) {
  const actor = await requirePagePermission("master.organization.view");
  const params = await searchParams;

  const parsed = listLinesQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listLinesQuerySchema.parse({});

  const { items, total } = await listLines(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.organization.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama lini..."
          ariaLabel="Cari lini produksi"
          status={listParams.status}
        />
        {canWrite ? <CreateLineButton /> : null}
      </div>
      <LinesTable lines={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} lini terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
