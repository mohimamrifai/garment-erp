import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/utils/dates";
import { listLocationOptions } from "@/modules/master/warehouse/service";
import { ReceiptForm, type ReceiptFormItem } from "@/modules/purchasing/components/receipt-form";
import { getPurchaseOrderDetail, listReceivablePurchaseOrders } from "@/modules/purchasing/service";

export const metadata: Metadata = { title: "Buat Penerimaan Material" };

type NewReceiptPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function NewReceiptPage({ searchParams }: NewReceiptPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat Penerimaan Material"
        description="Catat barang yang datang; posting penerimaan untuk menambah stok gudang."
      />
      <Suspense fallback={<ReceiptFormSkeleton />}>
        <NewReceiptSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ReceiptFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

async function NewReceiptSection({ searchParams }: NewReceiptPageProps) {
  await requirePagePermission("receipt.create");
  const params = await searchParams;
  const purchaseOrderId = typeof params.po === "string" && params.po ? params.po : null;

  const [locations, receivableOptions] = await Promise.all([
    listLocationOptions(),
    listReceivablePurchaseOrders(),
  ]);

  if (!purchaseOrderId) {
    return (
      <ReceiptForm
        mode="create"
        locations={locations}
        purchaseOrderOptions={receivableOptions}
        items={[]}
        initial={{ receivedAt: getTodayDate(), locationId: "", notes: "" }}
      />
    );
  }

  let detail;
  try {
    detail = await getPurchaseOrderDetail(purchaseOrderId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const items: ReceiptFormItem[] = detail.items
    .filter((item) => Number(item.remainingQuantity) > 0)
    .map((item) => ({
      purchaseOrderItemId: item.id,
      materialCode: item.materialCode,
      materialName: item.materialName,
      unitCode: item.unitCode,
      orderedQuantity: item.orderedQuantity,
      maxAcceptedQuantity: item.remainingQuantity,
      receivedQuantity: Number(item.remainingQuantity),
      acceptedQuantity: Number(item.remainingQuantity),
      notes: "",
    }));

  return (
    <ReceiptForm
      mode="create"
      locations={locations}
      purchaseOrder={{
        id: detail.order.id,
        number: detail.order.number,
        supplierName: detail.supplier.name,
      }}
      items={items}
      initial={{ receivedAt: getTodayDate(), locationId: "", notes: "" }}
    />
  );
}
