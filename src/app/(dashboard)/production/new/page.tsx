import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { getDateOffset, getTodayDate } from "@/lib/utils/dates";
import { listLinesQuerySchema } from "@/modules/master/production-line/schemas";
import { listLines } from "@/modules/master/production-line/service";
import { SpkForm } from "@/modules/production/components/spk-form";
import { listProducibleSalesOrderItems } from "@/modules/production/service";

export const metadata: Metadata = { title: "Buat SPK" };

export default function NewProductionOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buat SPK"
        description="SPK dibuat dari item sales order terkonfirmasi; BOM aktif dikunci dan empat tahap disiapkan otomatis."
      />
      <Suspense fallback={<SpkFormSkeleton />}>
        <NewProductionOrderSection />
      </Suspense>
    </div>
  );
}

function SpkFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

async function NewProductionOrderSection() {
  await requirePagePermission("production.create");

  const [soItems, linesResult] = await Promise.all([
    listProducibleSalesOrderItems(),
    listLines(listLinesQuerySchema.parse({ status: "active", pageSize: 100 })),
  ]);

  if (soItems.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>Tidak ada item SO yang siap diproduksi</EmptyTitle>
          <EmptyDescription>
            SPK dibuat dari item sales order berstatus dikonfirmasi/dalam produksi yang sudah
            memiliki BOM aktif dan masih menyisakan kuantitas belum direncanakan.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const lines = linesResult.items.map((line) => ({
    id: line.id,
    code: line.code,
    name: line.name,
  }));

  return (
    <SpkForm
      soItems={soItems}
      lines={lines}
      defaults={{ plannedStartDate: getTodayDate(), plannedEndDate: getDateOffset(14) }}
    />
  );
}
