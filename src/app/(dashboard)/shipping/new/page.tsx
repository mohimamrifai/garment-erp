import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/utils/dates";
import { ShipmentCreateForm } from "@/modules/shipping/components/shipment-create-form";
import { listShippableSalesOrders } from "@/modules/shipping/service";

export const metadata: Metadata = { title: "Buat Pengiriman" };

type NewShipmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function NewShipmentPage({ searchParams }: NewShipmentPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat Pengiriman"
        description="Pilih pesanan aktif, tentukan item yang dikirim, lalu simpan sebagai draf."
      />
      <Suspense fallback={<ShipmentFormSkeleton />}>
        <NewShipmentSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ShipmentFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

async function NewShipmentSection({ searchParams }: NewShipmentPageProps) {
  await requirePagePermission("shipment.create");
  const params = await searchParams;
  const orders = await listShippableSalesOrders();
  const requestedOrderId = typeof params.so === "string" ? params.so : undefined;

  return (
    <ShipmentCreateForm
      orders={orders}
      defaultSalesOrderId={requestedOrderId}
      today={getTodayDate()}
    />
  );
}
