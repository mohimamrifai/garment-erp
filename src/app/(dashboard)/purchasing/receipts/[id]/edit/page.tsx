import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { listLocationOptions } from "@/modules/master/warehouse/service";
import { ReceiptForm, type ReceiptFormItem } from "@/modules/purchasing/components/receipt-form";
import { getMaterialReceiptDetail, getPurchaseOrderDetail } from "@/modules/purchasing/service";
import { isEditableReceiptStatus } from "@/modules/purchasing/status";

export const metadata: Metadata = { title: "Ubah Penerimaan Material" };

type EditReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default function EditReceiptPage({ params }: EditReceiptPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<EditReceiptSkeleton />}>
        <EditReceiptSection params={params} />
      </Suspense>
    </div>
  );
}

function EditReceiptSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  );
}

async function EditReceiptSection({ params }: EditReceiptPageProps) {
  await requirePagePermission("receipt.update");
  const { id } = await params;

  let detail;
  try {
    detail = await getMaterialReceiptDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Hanya draf yang dapat diubah — selain itu kembali ke detail.
  if (!isEditableReceiptStatus(detail.receipt.status)) {
    redirect(`/purchasing/receipts/${id}`);
  }

  const [purchaseOrderDetail, locations] = await Promise.all([
    getPurchaseOrderDetail(detail.receipt.purchaseOrderId),
    listLocationOptions(),
  ]);
  const remainingByItem = new Map(
    purchaseOrderDetail.items.map((item) => [item.id, item.remainingQuantity]),
  );

  const items: ReceiptFormItem[] = detail.items.map((item) => ({
    purchaseOrderItemId: item.purchaseOrderItemId,
    materialCode: item.materialCode,
    materialName: item.materialName,
    unitCode: item.unitCode,
    orderedQuantity: item.orderedQuantity,
    maxAcceptedQuantity: remainingByItem.get(item.purchaseOrderItemId) ?? item.orderedQuantity,
    receivedQuantity: Number(item.receivedQuantity),
    acceptedQuantity: Number(item.acceptedQuantity),
    notes: item.notes ?? "",
  }));

  return (
    <>
      <PageHeader
        title={`Ubah ${detail.receipt.number}`}
        description="Perubahan hanya tersimpan selama penerimaan masih draf dan belum diposting."
      />
      <ReceiptForm
        mode="edit"
        receiptId={detail.receipt.id}
        locations={locations}
        purchaseOrder={{
          id: purchaseOrderDetail.order.id,
          number: purchaseOrderDetail.order.number,
          supplierName: purchaseOrderDetail.supplier.name,
        }}
        items={items}
        initial={{
          receivedAt: detail.receipt.receivedAt,
          locationId: detail.receipt.locationId,
          notes: detail.receipt.notes ?? "",
        }}
      />
    </>
  );
}
