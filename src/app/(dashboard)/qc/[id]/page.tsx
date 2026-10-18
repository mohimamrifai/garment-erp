import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatQty } from "@/lib/utils/currency";
import { formatDateTimeId } from "@/lib/utils/dates";
import { StageCodeBadge } from "@/modules/production/components/production-badges";
import { remainingReworkInspectableQuantity } from "@/modules/production/status";
import { QcResultBadge } from "@/modules/qc/components/qc-badges";
import { getQcInspectionDetail } from "@/modules/qc/service";

export const metadata: Metadata = { title: "Detail Inspeksi QC" };

type QcDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function QcDetailPage({ params }: QcDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<QcDetailSkeleton />}>
        <QcDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function QcDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

async function QcDetailSection({ params }: QcDetailPageProps) {
  const actor = await requirePagePermission("qc.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getQcInspectionDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { inspection, stage, order, item, buyerName, inspectedByName, defects, parent, children } =
    detail;

  const followedUp = children.reduce((total, child) => total + child.inspectedQuantity, 0);
  const remainingRework =
    inspection.result === "REWORK" || inspection.result === "FAIL"
      ? remainingReworkInspectableQuantity({
          parentRejectedQuantity: inspection.rejectedQuantity,
          followedUpQuantity: followedUp,
        })
      : 0;
  const canFollowUp = can(actor.roles, "qc.inspect") && remainingRework > 0;

  return (
    <>
      <PageHeader
        title={inspection.number}
        description={`${order.number} · ${item.productName} (${item.variantSku}) · ${buyerName}`}
        actions={
          <>
            <Link
              href="/qc"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Daftar Inspeksi
            </Link>
            {canFollowUp ? (
              <Button
                size="sm"
                render={<Link href={`/qc/new?parent=${inspection.id}`} />}
              >
                Inspeksi Ulang
              </Button>
            ) : null}
          </>
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Hasil
          </dt>
          <dd>
            <QcResultBadge result={inspection.result} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tahap
          </dt>
          <dd className="flex items-center gap-2">
            <StageCodeBadge stageCode={stage.stageCode} />
            <span className="font-mono text-xs text-muted-foreground">
              #{stage.sequenceNumber}
            </span>
          </dd>
          <dd>
            <Link
              href={`/production/${order.id}`}
              className="nums rounded-sm font-mono text-xs underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {order.number}
            </Link>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Diperiksa / Lolos / Cacat
          </dt>
          <dd className="nums font-mono text-sm font-medium">
            {formatQty(inspection.inspectedQuantity)} / {formatQty(inspection.passedQuantity)} /{" "}
            {formatQty(inspection.rejectedQuantity)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Diinspeksi Oleh
          </dt>
          <dd className="text-sm font-medium">{inspectedByName ?? "—"}</dd>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {formatDateTimeId(inspection.inspectedAt)}
          </dd>
        </div>
        {parent ? (
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Inspeksi Induk
            </dt>
            <dd>
              <Link
                href={`/qc/${parent.id}`}
                className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {parent.number}
              </Link>
            </dd>
          </div>
        ) : null}
        {remainingRework > 0 ? (
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Sisa Jatah Rework
            </dt>
            <dd className="nums font-mono text-sm font-medium">
              {formatQty(remainingRework)} unit
            </dd>
          </div>
        ) : null}
        {inspection.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-3">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Catatan
            </dt>
            <dd className="text-sm">{inspection.notes}</dd>
          </div>
        ) : null}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Rincian Cacat
        </h2>
        {defects.length === 0 ? (
          <p className="rounded-lg border p-4 text-[13px] text-muted-foreground">
            Tidak ada rincian cacat pada inspeksi ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Kode</TableHead>
                  <TableHead>Nama Cacat</TableHead>
                  <TableHead className="w-28 text-right">Kuantitas</TableHead>
                  <TableHead className="w-40">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect) => (
                  <TableRow key={defect.id}>
                    <TableCell className="nums font-mono text-xs">{defect.defectCode}</TableCell>
                    <TableCell className="font-medium">{defect.defectName}</TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(defect.quantity)}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {defect.disposition ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Riwayat Inspeksi Ulang
        </h2>
        {children.length === 0 ? (
          <p className="rounded-lg border p-4 text-[13px] text-muted-foreground">
            Belum ada inspeksi ulang untuk inspeksi ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Nomor</TableHead>
                  <TableHead className="w-28 text-right">Diperiksa</TableHead>
                  <TableHead className="w-28 text-right">Lolos</TableHead>
                  <TableHead className="w-28 text-right">Cacat</TableHead>
                  <TableHead className="w-40">Hasil</TableHead>
                  <TableHead className="w-44">Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.map((child) => (
                  <TableRow key={child.id}>
                    <TableCell>
                      <Link
                        href={`/qc/${child.id}`}
                        className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {child.number}
                      </Link>
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(child.inspectedQuantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(child.passedQuantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(child.rejectedQuantity)}
                    </TableCell>
                    <TableCell>
                      <QcResultBadge result={child.result} />
                    </TableCell>
                    <TableCell className="nums font-mono text-xs text-muted-foreground">
                      {formatDateTimeId(child.inspectedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
