import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/utils/dates";
import { listMaterialOptions } from "@/modules/master/material/service";
import { listSupplierOptions } from "@/modules/master/supplier/service";
import { PurchaseOrderForm } from "@/modules/purchasing/components/po-form";
import type { PurchaseOrderFormInput } from "@/modules/purchasing/schemas";
import { getProductionOrderDetail } from "@/modules/production/service";

export const metadata: Metadata = { title: "Buat Purchase Order" };

type NewPurchaseOrderPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function NewPurchaseOrderPage({ searchParams }: NewPurchaseOrderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat Purchase Order"
        description="PO baru dibuat sebagai draf — pesan ke supplier setelah item lengkap."
      />
      <Suspense fallback={<PurchaseOrderFormSkeleton />}>
        <NewPurchaseOrderSection searchParams={searchParams} />
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

async function NewPurchaseOrderSection({ searchParams }: NewPurchaseOrderPageProps) {
  await requirePagePermission("po.create");
  const params = await searchParams;
  const spkId = typeof params.spk === "string" ? params.spk : "";

  const [suppliers, materials] = await Promise.all([
    listSupplierOptions(),
    listMaterialOptions(),
  ]);

  let initial: PurchaseOrderFormInput = {
    supplierId: "",
    orderDate: getTodayDate(),
    expectedDate: "",
    notes: "",
    items: [{ materialId: "", orderedQuantity: 1, unitPrice: 0, notes: "" }],
  };
  let notice: string | undefined;

  // Prefill dari kekurangan material SPK ("Buat PO dari Kekurangan", FR-07).
  if (spkId) {
    try {
      const detail = await getProductionOrderDetail(spkId);
      const shortages = detail.planning.rows.filter((row) => row.shortageQuantity > 0);
      if (shortages.length > 0) {
        initial = {
          supplierId: "",
          orderDate: getTodayDate(),
          expectedDate: "",
          notes: `Kekurangan material SPK ${detail.order.number} (${detail.item.productName} ${detail.item.size}/${detail.item.color}).`,
          items: shortages.map((row) => ({
            materialId: row.materialId,
            orderedQuantity: row.shortageQuantity,
            unitPrice: 0,
          notes: `Kekurangan ${detail.order.number}`,
          })),
        };
        notice = `Item diisi otomatis dari kekurangan material SPK ${detail.order.number} (${shortages.length} material). Periksa kuantitas dan harga sebelum menyimpan.`;
      }
    } catch {
      // SPK tidak ditemukan / tidak berhak — jatuh kembali ke form kosong.
    }
  }

  return (
    <PurchaseOrderForm mode="create" suppliers={suppliers} materials={materials} initial={initial} notice={notice} />
  );
}
