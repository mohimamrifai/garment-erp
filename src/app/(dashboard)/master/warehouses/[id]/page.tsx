import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ActiveStatusBadge } from "@/components/master-data/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { can } from "@/lib/permissions";
import { CreateLocationButton } from "@/modules/master/warehouse/components/location-form-dialog";
import { LocationsTable } from "@/modules/master/warehouse/components/locations-table";
import { getWarehouseById, listLocations } from "@/modules/master/warehouse/service";

export const metadata: Metadata = { title: "Detail Gudang" };

type WarehouseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function WarehouseDetailPage({ params }: WarehouseDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<WarehouseDetailSkeleton />}>
        <WarehouseDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function WarehouseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function WarehouseDetailSection({ params }: WarehouseDetailPageProps) {
  const actor = await requirePagePermission("master.warehouse.view");
  const { id } = await params;

  let warehouse;
  try {
    warehouse = await getWarehouseById(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const locations = await listLocations(warehouse.id);
  const canWrite = can(actor.roles, "master.warehouse.manage");

  return (
    <>
      <PageHeader
        title={warehouse.name}
        description={`Kode ${warehouse.code} · ${locations.length} lokasi`}
        actions={
          canWrite ? (
            <CreateLocationButton warehouseId={warehouse.id} warehouseCode={warehouse.code} />
          ) : null
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Kode Gudang
          </dt>
          <dd className="font-mono text-sm font-medium">{warehouse.code}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd>
            <ActiveStatusBadge isActive={warehouse.isActive} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Lokasi
          </dt>
          <dd className="nums font-mono text-sm">{locations.length}</dd>
        </div>
        {warehouse.address ? (
          <div className="flex flex-col gap-1 sm:col-span-3">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Alamat
            </dt>
            <dd className="text-sm">{warehouse.address}</dd>
          </div>
        ) : null}
      </dl>

      <LocationsTable
        locations={locations}
        canWrite={canWrite}
        warehouseId={warehouse.id}
        warehouseCode={warehouse.code}
      />
    </>
  );
}
