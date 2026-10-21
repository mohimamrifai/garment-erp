import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateUomButton } from "@/modules/master/uom/components/uom-form-dialog";
import { UomsTable } from "@/modules/master/uom/components/uoms-table";
import { listUomsQuerySchema } from "@/modules/master/uom/schemas";
import { listUoms } from "@/modules/master/uom/service";

export const metadata: Metadata = { title: "Satuan & Ukur" };

type UomsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function UomsPage({ searchParams }: UomsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Satuan & Ukur"
        description="Satuan pengukuran material dan hasil produksi."
      />
      <Suspense fallback={<UomsSectionSkeleton />}>
        <UomsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function UomsSectionSkeleton() {
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

async function UomsSection({ searchParams }: UomsPageProps) {
  const actor = await requirePagePermission("master.uom.view");
  const params = await searchParams;

  const parsed = listUomsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listUomsQuerySchema.parse({});

  const { items, total } = await listUoms(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.uom.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama satuan..."
          ariaLabel="Cari satuan"
          status={listParams.status}
        />
        {canWrite ? <CreateUomButton /> : null}
      </div>
      <UomsTable uoms={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} satuan terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
