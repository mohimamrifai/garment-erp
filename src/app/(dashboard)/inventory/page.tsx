import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listMaterialOptions } from "@/modules/master/material/service";
import { listVariantOptions } from "@/modules/master/product/service";
import { listLocationOptions, listWarehouseOptions } from "@/modules/master/warehouse/service";
import { BalancesTable } from "@/modules/inventory/components/balances-table";
import { StockActions } from "@/modules/inventory/components/stock-actions";
import { listInventoryBalancesQuerySchema } from "@/modules/inventory/schemas";
import { listInventoryBalances } from "@/modules/inventory/service";

export const metadata: Metadata = { title: "Inventori" };

type InventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function InventoryPage({ searchParams }: InventoryPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventori"
        description="Saldo stok material dan barang jadi per lokasi penyimpanan."
      />
      <Suspense fallback={<InventorySectionSkeleton />}>
        <InventorySection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function InventorySectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function InventorySection({ searchParams }: InventoryPageProps) {
  const actor = await requirePagePermission("inventory.view");
  const params = await searchParams;

  const parsed = listInventoryBalancesQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    warehouse: typeof params.warehouse === "string" ? params.warehouse : undefined,
    location: typeof params.location === "string" ? params.location : undefined,
    itemType: params.itemType,
    low: params.low,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listInventoryBalancesQuerySchema.parse({});

  const canMove = can(actor.roles, "inventory.move");
  const canAdjust = can(actor.roles, "inventory.adjust");

  const [{ items, total, lowStockCount }, warehouses, locations, materials, variants] =
    await Promise.all([
      listInventoryBalances(listParams),
      listWarehouseOptions(),
      listLocationOptions(),
      canMove || canAdjust ? listMaterialOptions() : Promise.resolve([]),
      canMove || canAdjust ? listVariantOptions() : Promise.resolve([]),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const warehouseOptions = warehouses.map((warehouse) => ({
    value: warehouse.id,
    label: `${warehouse.name} (${warehouse.code})`,
  }));
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.warehouseName} — ${location.code}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode/nama material atau SKU varian..."
          ariaLabel="Cari saldo stok"
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
            {
              key: "location",
              value: listParams.location || "all",
              allLabel: "Semua lokasi",
              options: locationOptions,
              widthClass: "w-48",
              "aria-label": "Filter lokasi",
            },
            {
              key: "itemType",
              value: listParams.itemType,
              allLabel: "Semua tipe",
              options: [
                { value: "MATERIAL", label: "Material" },
                { value: "FINISHED_GOOD", label: "Barang Jadi" },
              ],
              widthClass: "w-36",
              "aria-label": "Filter tipe item",
            },
            {
              key: "low",
              value: listParams.low === "1" ? "1" : "all",
              allLabel: "Semua stok",
              options: [{ value: "1", label: "Di bawah minimum" }],
              widthClass: "w-44",
              "aria-label": "Filter stok minimum",
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <StockActions
            canMove={canMove}
            canAdjust={canAdjust}
            materials={materials}
            variants={variants}
            locations={locations}
          />
        </div>
      </div>

      {lowStockCount > 0 && listParams.low !== "1" ? (
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            {lowStockCount} material berada di bawah stok minimum.{" "}
            <Link
              href="/inventory?low=1"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Lihat daftar
            </Link>
          </span>
        </p>
      ) : null}

      <BalancesTable balances={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} baris saldo ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
