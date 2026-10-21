import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateWarehouseButton } from "@/modules/master/warehouse/components/warehouse-form-dialog";
import { WarehousesTable } from "@/modules/master/warehouse/components/warehouses-table";
import { listWarehousesQuerySchema } from "@/modules/master/warehouse/schemas";
import { listWarehouses } from "@/modules/master/warehouse/service";

export const metadata: Metadata = { title: "Gudang" };

type WarehousesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function WarehousesPage({ searchParams }: WarehousesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gudang"
        description="Gudang dan lokasi penyimpanan material serta barang jadi."
      />
      <Suspense fallback={<WarehousesSectionSkeleton />}>
        <WarehousesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function WarehousesSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function WarehousesSection({ searchParams }: WarehousesPageProps) {
  const actor = await requirePagePermission("master.warehouse.view");
  const params = await searchParams;

  const parsed = listWarehousesQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listWarehousesQuerySchema.parse({});

  const { items, total } = await listWarehouses(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.warehouse.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama gudang..."
          ariaLabel="Cari gudang"
          status={listParams.status}
        />
        {canWrite ? <CreateWarehouseButton /> : null}
      </div>
      <WarehousesTable warehouses={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} gudang terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
