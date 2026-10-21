import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { listLocationOptions } from "@/modules/master/warehouse/service";
import { MovementsDateFilter } from "@/modules/inventory/components/movements-date-filter";
import { MovementsTable } from "@/modules/inventory/components/movements-table";
import { TRANSACTION_TYPE_LABELS } from "@/modules/inventory/components/inventory-badges";
import { listInventoryTransactionsQuerySchema } from "@/modules/inventory/schemas";
import { listInventoryTransactions } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Mutasi Stok" };

type MovementsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MovementsPage({ searchParams }: MovementsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mutasi Stok"
        description="Riwayat semua transaksi stok — penerimaan, pengeluaran, transfer, dan penyesuaian."
      />
      <Suspense fallback={<MovementsSectionSkeleton />}>
        <MovementsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function MovementsSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function MovementsSection({ searchParams }: MovementsPageProps) {
  await requirePagePermission("inventory.view");
  const params = await searchParams;

  const parsed = listInventoryTransactionsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    type: params.type,
    itemType: params.itemType,
    location: typeof params.location === "string" ? params.location : undefined,
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listInventoryTransactionsQuerySchema.parse({});

  const [{ items, total }, locations] = await Promise.all([
    listInventoryTransactions(listParams),
    listLocationOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.warehouseName} — ${location.code}`,
  }));
  const typeOptions = Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <ListSearch
          placeholder="Cari transaksi atau material..."
          ariaLabel="Cari mutasi stok"
          status="all"
          hideStatus
          filters={[
            {
              key: "type",
              value: listParams.type,
              allLabel: "Semua tipe",
              options: typeOptions,
              widthClass: "w-48",
              "aria-label": "Filter tipe mutasi",
            },
            {
              key: "itemType",
              value: listParams.itemType,
              allLabel: "Semua item",
              options: [
                { value: "MATERIAL", label: "Material" },
                { value: "FINISHED_GOOD", label: "Barang Jadi" },
              ],
              widthClass: "w-36",
              "aria-label": "Filter tipe item",
            },
            {
              key: "location",
              value: listParams.location || "all",
              allLabel: "Semua lokasi",
              options: locationOptions,
              widthClass: "w-48",
              "aria-label": "Filter lokasi",
            },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Rentang tanggal</span>
          <MovementsDateFilter from={listParams.from} to={listParams.to} />
        </div>
      </div>

      <MovementsTable transactions={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} mutasi tercatat
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
