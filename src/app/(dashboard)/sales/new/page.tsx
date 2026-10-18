import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/utils/dates";
import { listBuyerOptions } from "@/modules/buyer/service";
import { listVariantOptions } from "@/modules/master/product/service";
import { SalesOrderForm } from "@/modules/sales-order/components/so-form";

export const metadata: Metadata = { title: "Buat Sales Order" };

export default function NewSalesOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat Sales Order"
        description="Pesanan baru dibuat sebagai draf — dapat diubah sampai dikonfirmasi."
      />
      <Suspense fallback={<SalesOrderFormSkeleton />}>
        <NewSalesOrderSection />
      </Suspense>
    </div>
  );
}

function SalesOrderFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

async function NewSalesOrderSection() {
  await requirePagePermission("so.create");

  const [buyers, variants] = await Promise.all([listBuyerOptions(), listVariantOptions()]);

  return (
    <SalesOrderForm
      mode="create"
      buyers={buyers}
      variants={variants}
      initial={{
        buyerId: "",
        orderDate: getTodayDate(),
        dueDate: "",
        notes: "",
        items: [{ variantId: "", quantity: 1, unitPrice: 0, dueDate: "", notes: "" }],
      }}
    />
  );
}
