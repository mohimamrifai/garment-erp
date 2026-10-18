import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { listBuyerOptions } from "@/modules/buyer/service";
import { listVariantOptions } from "@/modules/master/product/service";
import { SalesOrderForm } from "@/modules/sales-order/components/so-form";
import { getSalesOrderDetail } from "@/modules/sales-order/service";
import { isEditableSoStatus } from "@/modules/sales-order/status";

export const metadata: Metadata = { title: "Ubah Sales Order" };

type EditSalesOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default function EditSalesOrderPage({ params }: EditSalesOrderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<EditSalesOrderSkeleton />}>
        <EditSalesOrderSection params={params} />
      </Suspense>
    </div>
  );
}

function EditSalesOrderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  );
}

async function EditSalesOrderSection({ params }: EditSalesOrderPageProps) {
  await requirePagePermission("so.update");
  const { id } = await params;

  let detail;
  try {
    detail = await getSalesOrderDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Hanya draf yang dapat diubah — selain itu kembali ke detail.
  if (!isEditableSoStatus(detail.order.status)) redirect(`/sales/${id}`);

  const [buyers, variants] = await Promise.all([listBuyerOptions(), listVariantOptions()]);

  return (
    <>
      <PageHeader
        title={`Ubah ${detail.order.number}`}
        description="Perubahan hanya tersimpan selama pesanan masih draf."
      />
      <SalesOrderForm
        mode="edit"
        salesOrderId={detail.order.id}
        buyers={buyers}
        variants={variants}
        initial={{
          buyerId: detail.order.buyerId,
          orderDate: detail.order.orderDate,
          dueDate: detail.order.dueDate,
          notes: detail.order.notes ?? "",
          items: detail.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            dueDate: item.dueDate ?? "",
            notes: item.notes ?? "",
          })),
        }}
      />
    </>
  );
}
