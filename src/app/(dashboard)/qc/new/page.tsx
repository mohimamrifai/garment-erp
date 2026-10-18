import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { QcForm, type QcStageOption } from "@/modules/qc/components/qc-form";
import { getQcInspectionDetail } from "@/modules/qc/service";
import { listInspectableStages } from "@/modules/production/service";
import { remainingReworkInspectableQuantity } from "@/modules/production/status";

export const metadata: Metadata = { title: "Inspeksi QC" };

type NewQcPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function NewQcPage({ searchParams }: NewQcPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inspeksi QC"
        description="Inspeksi output tahap produksi — inspeksi ulang dilakukan dari inspeksi induk berstatus Rework/Gagal."
      />
      <Suspense fallback={<QcFormSkeleton />}>
        <NewQcSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function QcFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

async function NewQcSection({ searchParams }: NewQcPageProps) {
  await requirePagePermission("qc.inspect");
  const params = await searchParams;
  const parentId = typeof params.parent === "string" ? params.parent : "";

  if (parentId) {
    let detail;
    try {
      detail = await getQcInspectionDetail(parentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }

    const { inspection, stage, order, item, children } = detail;
    if (inspection.result !== "REWORK" && inspection.result !== "FAIL") {
      return (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia>
              <ClipboardCheck />
            </EmptyMedia>
            <EmptyTitle>Inspeksi ini tidak memerlukan inspeksi ulang</EmptyTitle>
            <EmptyDescription>
              Inspeksi ulang hanya dibuat dari inspeksi induk berstatus Rework atau Gagal.{" "}
              <Link href={`/qc/${inspection.id}`} className="underline underline-offset-4">
                Kembali ke detail inspeksi
              </Link>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    const followedUp = children.reduce((total, child) => total + child.inspectedQuantity, 0);
    const remaining = remainingReworkInspectableQuantity({
      parentRejectedQuantity: inspection.rejectedQuantity,
      followedUpQuantity: followedUp,
    });

    if (remaining <= 0) {
      return (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia>
              <ClipboardCheck />
            </EmptyMedia>
            <EmptyTitle>Jatah rework sudah diperiksa semua</EmptyTitle>
            <EmptyDescription>
              Seluruh kuantitas yang ditolak inspeksi {inspection.number} telah memiliki inspeksi
              ulang.{" "}
              <Link href={`/qc/${inspection.id}`} className="underline underline-offset-4">
                Lihat riwayat
              </Link>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <QcForm
        stageOptions={[]}
        parent={{
          inspectionId: inspection.id,
          number: inspection.number,
          stageId: stage.id,
          stageCode: stage.stageCode,
          orderNumber: order.number,
          productName: item.productName,
          variantSku: item.variantSku,
          remainingQuantity: remaining,
        }}
      />
    );
  }

  const inspectableStages = await listInspectableStages();
  if (inspectableStages.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada output yang siap diperiksa</EmptyTitle>
          <EmptyDescription>
            Inspeksi dibuat setelah tahap produksi memiliki output lolos yang belum diperiksa.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const stageOptions: QcStageOption[] = inspectableStages.map((stage) => ({
    stageId: stage.stageId,
    stageCode: stage.stageCode,
    productionOrderNumber: stage.productionOrderNumber,
    productName: stage.productName,
    variantSku: stage.variantSku,
    inspectableQuantity: stage.inspectableQuantity,
  }));

  return <QcForm stageOptions={stageOptions} parent={null} />;
}
