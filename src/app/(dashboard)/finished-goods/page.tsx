import type { Metadata } from "next";
import { Suspense } from "react";
import { Boxes, PackageCheck, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { formatNumber } from "@/lib/utils/currency";
import { FinishedGoodsLotsTable } from "@/modules/finished-goods/components/finished-goods-lots-table";
import { FinishedGoodsTable } from "@/modules/finished-goods/components/finished-goods-table";
import { listFinishedGoodsQuerySchema } from "@/modules/finished-goods/schemas";
import {
  listFinishedGoodsLots,
  listFinishedGoodsStock,
} from "@/modules/finished-goods/service";
import { listWarehouseOptions } from "@/modules/master/warehouse/service";

export const metadata: Metadata = { title: "Barang Jadi" };

type FinishedGoodsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function FinishedGoodsPage({ searchParams }: FinishedGoodsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Barang Jadi"
        description="Stok barang jadi hasil QC akhir — hanya barang yang lolos QC yang dapat dialokasikan dan dikirim."
      />
      <Suspense fallback={<FinishedGoodsSkeleton />}>
        <FinishedGoodsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function FinishedGoodsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function FinishedGoodsSection({ searchParams }: FinishedGoodsPageProps) {
  await requirePagePermission("fg.view");
  const params = await searchParams;

  const parsed = listFinishedGoodsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    warehouse: typeof params.warehouse === "string" ? params.warehouse : undefined,
    location: typeof params.location === "string" ? params.location : undefined,
    page: params.page,
  });
  const listParams = parsed.success
    ? parsed.data
    : listFinishedGoodsQuerySchema.parse({});

  const [{ items, total, totals }, warehouses, lots] = await Promise.all([
    listFinishedGoodsStock(listParams),
    listWarehouseOptions(),
    listFinishedGoodsLots(25),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const warehouseOptions = warehouses.map((warehouse) => ({
    value: warehouse.id,
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <CardDescription>Stok fisik</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">
                {formatNumber(totals.onHand)}
              </CardTitle>
            </div>
            <Boxes className="size-5 text-muted-foreground" aria-hidden />
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <CardDescription>Tersedia untuk dialokasikan</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">
                {formatNumber(totals.available)}
              </CardTitle>
            </div>
            <PackageCheck className="size-5 text-success" aria-hidden />
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <CardDescription>Varian bersaldo</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">
                {formatNumber(totals.variantCount)}
              </CardTitle>
            </div>
            <PackageSearch className="size-5 text-muted-foreground" aria-hidden />
          </CardHeader>
        </Card>
      </div>

      <ListSearch
        placeholder="Cari nama produk atau SKU varian..."
        ariaLabel="Cari barang jadi"
        status="all"
        hideStatus
        filters={[
          {
            key: "warehouse",
            value: listParams.warehouse || "all",
            allLabel: "Semua gudang",
            options: warehouseOptions,
            widthClass: "w-44",
            "aria-label": "Filter gudang",
          },
        ]}
      />

      <FinishedGoodsTable rows={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} baris saldo ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lot barang jadi terbaru</CardTitle>
          <CardDescription>
            Setiap lot terhubung ke SPK dan inspeksi QC akhir sebagai bukti ketertelusuran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinishedGoodsLotsTable lots={lots} />
        </CardContent>
      </Card>
    </div>
  );
}
