import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/utils/dates";
import { listMaterialOptions } from "@/modules/master/material/service";
import { listSupplierOptions } from "@/modules/master/supplier/service";
import { PurchaseOrderForm } from "@/modules/purchasing/components/po-form";

export const metadata: Metadata = { title: "Buat Purchase Order" };

export default function NewPurchaseOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat Purchase Order"
        description="PO baru dibuat sebagai draf — pesan ke supplier setelah item lengkap."
      />
      <Suspense fallback={<PurchaseOrderFormSkeleton />}>
        <NewPurchaseOrderSection />
      </Suspense>
    </div>
  );
}

function PurchaseOrderFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

async function NewPurchaseOrderSection() {
  await requirePagePermission("po.create");

  const [suppliers, materials] = await Promise.all([
    listSupplierOptions(),
    listMaterialOptions(),
  ]);

  return (
    <PurchaseOrderForm
      mode="create"
      suppliers={suppliers}
      materials={materials}
      initial={{
        supplierId: "",
        orderDate: getTodayDate(),
        expectedDate: "",
        notes: "",
        items: [{ materialId: "", orderedQuantity: 1, unitPrice: 0, notes: "" }],
      }}
    />
  );
}
