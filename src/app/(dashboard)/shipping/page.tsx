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
import { SHIPMENT_STATUS_LABELS } from "@/modules/shipping/status";
import { ShipmentsTable } from "@/modules/shipping/components/shipments-table";
import { listShipmentsQuerySchema } from "@/modules/shipping/schemas";
import { listShipments } from "@/modules/shipping/service";

export const metadata: Metadata = { title: "Pengiriman" };

type ShippingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ShippingPage({ searchParams }: ShippingPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengiriman"
        description="Surat jalan barang jadi — parsial diperbolehkan, stok berkurang saat diposting."
      />
      <Suspense fallback={<ShippingSkeleton />}>
        <ShippingSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ShippingSkeleton() {
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

async function ShippingSection({ searchParams }: ShippingPageProps) {
  const actor = await requirePagePermission("shipment.view");
  const params = await searchParams;

  const parsed = listShipmentsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listShipmentsQuerySchema.parse({});
  const { items, total } = await listShipments(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canCreate = can(actor.roles, "shipment.create");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor SJ, nomor SO, atau buyer..."
          ariaLabel="Cari pengiriman"
          status="all"
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
              widthClass: "w-40",
              "aria-label": "Filter status pengiriman",
            },
          ]}
        />
        {canCreate ? (
          <Button nativeButton={false} render={<Link href="/shipping/new" />}>
            <Plus data-icon="inline-start" />
            Buat Pengiriman
          </Button>
        ) : null}
      </div>

      <ShipmentsTable shipments={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} pengiriman ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
