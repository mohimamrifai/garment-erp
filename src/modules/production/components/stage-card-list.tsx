import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQty } from "@/lib/utils/currency";
import { formatDateTimeId } from "@/lib/utils/dates";
import { QcResultBadge } from "@/modules/qc/components/qc-badges";
import type { ProductionOrderDetail, ProductionStageDetail } from "../service";
import { STAGE_CODE_LABELS } from "../status";
import { StageStatusBadge } from "./production-badges";
import { StageRecordButton } from "./stage-record-button";

type StageCardListProps = {
  detail: ProductionOrderDetail;
  canRecord: boolean;
};

/**
 * Kartu keempat tahap produksi: target, input tersedia, catatan output,
 * riwayat inspeksi QC, dan tombol catat output (termasuk rework).
 */
export function StageCardList({ detail, canRecord }: StageCardListProps) {
  const endpoint = `/api/v1/production-orders/${detail.order.id}/records`;
  const locked = detail.order.status === "CANCELLED";

  return (
    <div className="flex flex-col gap-4">
      {detail.stages.map((stage) => (
        <StageCard
          key={stage.id}
          stage={stage}
          orderNumber={detail.order.number}
          endpoint={endpoint}
          canRecord={canRecord && !locked}
        />
      ))}
    </div>
  );
}

function StageCard({
  stage,
  orderNumber,
  endpoint,
  canRecord,
}: {
  stage: ProductionStageDetail;
  orderNumber: string;
  endpoint: string;
  canRecord: boolean;
}) {
  const remainingNormal = Math.max(0, stage.inputQuantity - stage.normalProcessedQuantity);
  const remainingRework = Math.max(0, stage.reworkCapacity - stage.reworkProcessedQuantity);

  return (
    <section className="rounded-lg border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tahap {stage.sequenceNumber}
          </span>
          <h2 className="text-sm font-semibold">{STAGE_CODE_LABELS[stage.stageCode]}</h2>
          <StageStatusBadge status={stage.status} />
          {remainingRework > 0 ? (
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
              Rework {formatQty(remainingRework)} unit menunggu
            </Badge>
          ) : null}
        </div>
        {canRecord ? (
          <StageRecordButton
            endpoint={endpoint}
            orderNumber={orderNumber}
            stageCode={stage.stageCode}
            remainingNormal={remainingNormal}
            remainingRework={remainingRework}
          />
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 border-b p-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Target", value: stage.targetQuantity },
          { label: "Tersedia Diproses", value: stage.inputQuantity },
          { label: "Diproses", value: stage.processedQuantity },
          { label: "Lolos", value: stage.passedQuantity },
          { label: "Cacat", value: stage.rejectedQuantity },
          { label: "Sisa Diproses", value: stage.remainingQuantity },
        ].map((metric) => (
          <div key={metric.label} className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {metric.label}
            </dt>
            <dd className="nums font-mono text-sm font-medium">{formatQty(metric.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 p-4">
        {stage.records.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Belum ada catatan output untuk tahap ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Waktu</TableHead>
                  <TableHead className="w-24 text-right">Diproses</TableHead>
                  <TableHead className="w-24 text-right">Lolos</TableHead>
                  <TableHead className="w-24 text-right">Cacat</TableHead>
                  <TableHead className="w-24">Tipe</TableHead>
                  <TableHead>Petugas & Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stage.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="nums font-mono text-xs text-muted-foreground">
                      {formatDateTimeId(record.recordedAt)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(record.processedQuantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(record.passedQuantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatQty(record.rejectedQuantity)}
                    </TableCell>
                    <TableCell>
                      {record.isRework ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning/10 text-warning"
                        >
                          Rework
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {record.recordedByName ?? "—"}
                      {record.notes ? (
                        <span className="block text-[11px] text-muted-foreground">
                          {record.notes}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {stage.inspections.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Inspeksi QC
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Nomor</TableHead>
                    <TableHead className="w-24 text-right">Diperiksa</TableHead>
                    <TableHead className="w-24 text-right">Lolos</TableHead>
                    <TableHead className="w-24 text-right">Cacat</TableHead>
                    <TableHead className="w-44">Hasil</TableHead>
                    <TableHead className="w-44">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stage.inspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell>
                        <Link
                          href={`/qc/${inspection.id}`}
                          className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {inspection.number}
                        </Link>
                        {inspection.parentInspectionId ? (
                          <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                            inspeksi ulang
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(inspection.inspectedQuantity)}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(inspection.passedQuantity)}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(inspection.rejectedQuantity)}
                      </TableCell>
                      <TableCell>
                        <QcResultBadge result={inspection.result} />
                      </TableCell>
                      <TableCell className="nums font-mono text-xs text-muted-foreground">
                        {formatDateTimeId(inspection.inspectedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
