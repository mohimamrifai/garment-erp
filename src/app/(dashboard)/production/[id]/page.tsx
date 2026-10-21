import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
import { formatDateId, formatDateTimeId, getTodayDate } from "@/lib/utils/dates";
import { listLocationOptions } from "@/modules/master/warehouse/service";
import { IssueMaterialButton } from "@/modules/production/components/issue-material-button";
import { MaterialPlanningTable } from "@/modules/production/components/material-planning-table";
import { SpkDetailActions } from "@/modules/production/components/spk-detail-actions";
import { SpkStatusBadge } from "@/modules/production/components/production-badges";
import { StageCardList } from "@/modules/production/components/stage-card-list";
import { getProductionOrderDetail } from "@/modules/production/service";
import { SO_STATUS_LABELS } from "@/modules/sales-order/status";

export const metadata: Metadata = { title: "Detail SPK" };

type ProductionOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProductionOrderDetailPage({ params }: ProductionOrderDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ProductionOrderDetailSkeleton />}>
        <ProductionOrderDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function ProductionOrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

async function ProductionOrderDetailSection({ params }: ProductionOrderDetailPageProps) {
  const actor = await requirePagePermission("production.view");
  const { id } = await params;

  let detail;
  let locations;
  try {
    [detail, locations] = await Promise.all([getProductionOrderDetail(id), listLocationOptions()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { order, salesOrder, item, bom, line, planning, issues, totals } = detail;

  // Saran pemakaian = kebutuhan (bruto + cadangan) − yang sudah dipakai.
  const issuedByMaterial = new Map<string, number>();
  for (const issue of issues) {
    for (const issueItem of issue.items) {
      issuedByMaterial.set(
        issueItem.materialId,
        (issuedByMaterial.get(issueItem.materialId) ?? 0) + Number(issueItem.quantity),
      );
    }
  }
  const suggestions = planning.rows.map((row) => ({
    materialId: row.materialId,
    code: row.code,
    name: row.name,
    unitCode: row.unitCode,
    suggestedQuantity: Math.max(
      0,
      round4(
        row.grossQuantity +
          row.allowanceQuantity -
          (issuedByMaterial.get(row.materialId) ?? 0),
      ),
    ),
  }));

  return (
    <>
      <PageHeader
        title={order.number}
        description={`${item.productName} ${item.size}/${item.color} · ${item.variantSku} · ${salesOrder.buyerName}`}
        actions={
          <>
            <Link
              href="/production"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Daftar SPK
            </Link>
            <SpkDetailActions
              productionOrderId={order.id}
              number={order.number}
              canCancel={can(actor.roles, "production.cancel") && order.status === "OPEN"}
            />
          </>
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd>
            <SpkStatusBadge status={order.status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Sales Order
          </dt>
          <dd>
            <Link
              href={`/sales/${salesOrder.id}`}
              className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {salesOrder.number}
            </Link>
          </dd>
          <dd className="text-xs text-muted-foreground">
            {SO_STATUS_LABELS[salesOrder.status as keyof typeof SO_STATUS_LABELS] ??
              salesOrder.status}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Target Kuantitas
          </dt>
          <dd className="nums font-mono text-sm font-medium">
            {formatQty(totals.plannedQuantity)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Output Lolos (Packing)
          </dt>
          <dd className="nums font-mono text-sm font-medium">
            {formatQty(totals.outputQuantity)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Lini Produksi
          </dt>
          <dd className="text-sm font-medium">{line ? `${line.name} (${line.code})` : "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Jadwal
          </dt>
          <dd className="nums font-mono text-sm">
            {formatDateId(order.plannedStartDate)} — {formatDateId(order.plannedEndDate)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            BOM
          </dt>
          <dd className="nums font-mono text-sm">v{bom.version}</dd>
          <dd className="text-xs text-muted-foreground">
            Berlaku sejak {formatDateId(bom.effectiveFrom)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibuat
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {formatDateTimeId(order.createdAt)}
          </dd>
        </div>
        {order.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-4">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Catatan
            </dt>
            <dd className="text-sm">{order.notes}</dd>
          </div>
        ) : null}
      </dl>

      {order.shortageReason ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px]">
          <span className="font-medium text-warning">Material kurang — tetap dijalankan.</span>{" "}
          <span className="text-muted-foreground">{order.shortageReason}</span>
        </p>
      ) : null}

      {order.status === "CANCELLED" && order.cancelReason ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px]">
          <span className="font-medium text-destructive">SPK dibatalkan.</span>{" "}
          <span className="text-muted-foreground">{order.cancelReason}</span>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Kebutuhan Material
        </h2>
        <MaterialPlanningTable
          planning={planning}
          productionOrderId={order.id}
          canCreatePo={can(actor.roles, "po.create")}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Pemakaian Material
          </h2>
          {can(actor.roles, "production.issue") && order.status !== "CANCELLED" ? (
            <IssueMaterialButton
              endpoint={`/api/v1/production-orders/${order.id}/issues`}
              orderNumber={order.number}
              locations={locations}
              suggestions={suggestions}
              defaultIssuedAt={getTodayDate()}
            />
          ) : null}
        </div>

        {issues.length === 0 ? (
          <p className="rounded-lg border p-4 text-[13px] text-muted-foreground">
            Belum ada pemakaian material. Pemakaian material mengurangi stok secara otomatis
            dan tercatat per SPK.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {issues.map((issue) => (
              <div key={issue.id} className="overflow-hidden rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="nums font-mono text-[13px] font-medium">{issue.number}</span>
                    <span className="nums font-mono text-xs text-muted-foreground">
                      {formatDateId(issue.issuedAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">{issue.locationLabel}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {issue.createdByName ?? "—"} · {formatDateTimeId(issue.createdAt)}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-32 text-right">Kuantitas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issue.items.map((issueItem) => (
                      <TableRow key={issueItem.id}>
                        <TableCell>
                          <span className="font-medium">{issueItem.materialName}</span>
                          <span className="nums block font-mono text-[11px] text-muted-foreground">
                            {issueItem.materialCode} · {issueItem.unitCode}
                          </span>
                        </TableCell>
                        <TableCell className="nums text-right font-mono text-sm">
                          {formatQty(issueItem.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {issue.notes ? (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                    Catatan: {issue.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Tahapan Produksi
        </h2>
        <StageCardList detail={detail} canRecord={can(actor.roles, "production.record")} />
      </section>
    </>
  );
}
