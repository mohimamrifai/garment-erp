import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { listMaterialOptions } from "@/modules/master/material/service";
import { listSupplierOptions } from "@/modules/master/supplier/service";
import { PurchaseOrderForm } from "@/modules/purchasing/components/po-form";
import { getPurchaseOrderDetail } from "@/modules/purchasing/service";
import { isEditablePurchaseOrderStatus } from "@/modules/purchasing/status";

export const metadata: Metadata = { title: "Ubah Purchase Order" };

type EditPurchaseOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default function EditPurchaseOrderPage({ params }: EditPurchaseOrderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<EditPurchaseOrderSkeleton />}>
        <EditPurchaseOrderSection params={params} />
      </Suspense>
    </div>
  );
}

function EditPurchaseOrderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  );
}

async function EditPurchaseOrderSection({ params }: EditPurchaseOrderPageProps) {
  await requirePagePermission("po.update");
  const { id } = await params;

  let detail;
  try {
    detail = await getPurchaseOrderDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Hanya draf yang dapat diubah — selain itu kembali ke detail.
  if (!isEditablePurchaseOrderStatus(detail.order.status)) redirect(`/purchasing/${id}`);

  const [suppliers, materials] = await Promise.all([
    listSupplierOptions(),
    listMaterialOptions(),
  ]);

  return (
    <>
      <PageHeader
        title={`Ubah ${detail.order.number}`}
        description="Perubahan hanya tersimpan selama purchase order masih draf."
      />
      <PurchaseOrderForm
        mode="edit"
        purchaseOrderId={detail.order.id}
        suppliers={suppliers}
        materials={materials}
        initial={{
          supplierId: detail.order.supplierId,
          orderDate: detail.order.orderDate,
          expectedDate: detail.order.expectedDate ?? "",
          notes: detail.order.notes ?? "",
          items: detail.items.map((item) => ({
            materialId: item.materialId,
            orderedQuantity: Number(item.orderedQuantity),
            unitPrice: Number(item.unitPrice),
            notes: item.notes ?? "",
          })),
        }}
      />
    </>
  );
}
