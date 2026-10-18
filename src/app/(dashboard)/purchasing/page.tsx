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
import { PurchaseOrdersTable } from "@/modules/purchasing/components/purchase-orders-table";
import { listPurchaseOrdersQuerySchema } from "@/modules/purchasing/schemas";
import { listPurchaseOrders } from "@/modules/purchasing/service";
import { PO_STATUS_LABELS } from "@/modules/purchasing/status";

export const metadata: Metadata = { title: "Pembelian" };

type PurchasingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PurchasingPage({ searchParams }: PurchasingPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pembelian"
        description="Purchase order (PO) material ke supplier beserta status penerimaannya."
      />
      <Suspense fallback={<PurchasingSectionSkeleton />}>
        <PurchasingSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function PurchasingSectionSkeleton() {
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

async function PurchasingSection({ searchParams }: PurchasingPageProps) {
  const actor = await requirePagePermission("po.view");
  const params = await searchParams;

  const parsed = listPurchaseOrdersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listPurchaseOrdersQuerySchema.parse({});

  const { items, total } = await listPurchaseOrders(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  const statusOptions = (Object.keys(PO_STATUS_LABELS) as (keyof typeof PO_STATUS_LABELS)[]).map(
    (status) => ({ value: status, label: PO_STATUS_LABELS[status] }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor PO atau supplier..."
          ariaLabel="Cari purchase order"
          status={listParams.status}
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: statusOptions,
              widthClass: "w-44",
              "aria-label": "Filter status purchase order",
            },
          ]}
        />
        {can(actor.roles, "po.create") ? (
          <Button render={<Link href="/purchasing/new" />}>
            <Plus data-icon="inline-start" />
            Buat Purchase Order
          </Button>
        ) : null}
      </div>

      <PurchaseOrdersTable
        orders={items}
        canUpdate={can(actor.roles, "po.update")}
        canOrder={can(actor.roles, "po.order")}
        canCancel={can(actor.roles, "po.cancel")}
        canReceive={can(actor.roles, "receipt.create")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} purchase order terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
