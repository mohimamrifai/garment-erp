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
import { ProductionOrdersTable } from "@/modules/production/components/production-orders-table";
import { listProductionOrdersQuerySchema } from "@/modules/production/schemas";
import { listProductionOrders } from "@/modules/production/service";
import { SPK_STATUS_LABELS } from "@/modules/production/status";

export const metadata: Metadata = { title: "Produksi" };

type ProductionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ProductionPage({ searchParams }: ProductionPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produksi"
        description="Surat perintah kerja (SPK) per item sales order beserta progres tahapan produksinya."
      />
      <Suspense fallback={<ProductionSectionSkeleton />}>
        <ProductionSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ProductionSectionSkeleton() {
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

async function ProductionSection({ searchParams }: ProductionPageProps) {
  const actor = await requirePagePermission("production.view");
  const params = await searchParams;

  const parsed = listProductionOrdersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listProductionOrdersQuerySchema.parse({});

  const { items, total } = await listProductionOrders(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  const statusOptions = (
    Object.keys(SPK_STATUS_LABELS) as (keyof typeof SPK_STATUS_LABELS)[]
  ).map((status) => ({ value: status, label: SPK_STATUS_LABELS[status] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor SPK, SO, atau produk..."
          ariaLabel="Cari SPK"
          status={listParams.status}
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: statusOptions,
              widthClass: "w-44",
              "aria-label": "Filter status SPK",
            },
          ]}
        />
        {can(actor.roles, "production.create") ? (
          <Button render={<Link href="/production/new" />}>
            <Plus data-icon="inline-start" />
            Buat SPK
          </Button>
        ) : null}
      </div>

      <ProductionOrdersTable orders={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} SPK terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
