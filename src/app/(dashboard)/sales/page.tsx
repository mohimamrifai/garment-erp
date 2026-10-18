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
import { listSalesOrdersQuerySchema } from "@/modules/sales-order/schemas";
import { listSalesOrders } from "@/modules/sales-order/service";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";
import { SosTable } from "@/modules/sales-order/components/sos-table";

export const metadata: Metadata = { title: "Sales Order" };

type SalesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function SalesPage({ searchParams }: SalesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Order"
        description="Pesanan buyer dari draf hingga dikonfirmasi, siap masuk produksi."
      />
      <Suspense fallback={<SalesSectionSkeleton />}>
        <SalesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SalesSectionSkeleton() {
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

async function SalesSection({ searchParams }: SalesPageProps) {
  const actor = await requirePagePermission("so.view");
  const params = await searchParams;

  const parsed = listSalesOrdersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listSalesOrdersQuerySchema.parse({});

  const { items, total } = await listSalesOrders(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  const statusOptions = (Object.keys(SO_STATUS_LABELS) as (keyof typeof SO_STATUS_LABELS)[]).map(
    (status) => ({ value: status, label: SO_STATUS_LABELS[status] }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor SO atau buyer..."
          ariaLabel="Cari sales order"
          status={listParams.status}
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: statusOptions,
              widthClass: "w-44",
              "aria-label": "Filter status sales order",
            },
          ]}
        />
        {can(actor.roles, "so.create") ? (
          <Button render={<Link href="/sales/new" />}>
            <Plus data-icon="inline-start" />
            Buat Sales Order
          </Button>
        ) : null}
      </div>

      <SosTable
        orders={items}
        canUpdate={can(actor.roles, "so.update")}
        canConfirm={can(actor.roles, "so.confirm")}
        canCancel={can(actor.roles, "so.cancel")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} sales order terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
