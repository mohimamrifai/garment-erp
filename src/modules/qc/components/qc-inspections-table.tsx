import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
import { StageCodeBadge } from "@/modules/production/components/production-badges";
import type { QcInspectionListRow } from "../service";
import { QcResultBadge } from "./qc-badges";

/** Tabel daftar inspeksi QC lintas SPK. */
export function QcInspectionsTable({ inspections }: { inspections: QcInspectionListRow[] }) {
  if (inspections.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada inspeksi QC</EmptyTitle>
          <EmptyDescription>
            Inspeksi dibuat per tahap produksi setelah ada output yang dapat diperiksa.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Nomor</TableHead>
            <TableHead className="w-40">SPK</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead className="w-36">Tahap</TableHead>
            <TableHead className="w-24 text-right">Diperiksa</TableHead>
            <TableHead className="w-24 text-right">Lolos</TableHead>
            <TableHead className="w-24 text-right">Cacat</TableHead>
            <TableHead className="w-40">Hasil</TableHead>
            <TableHead className="w-44">Waktu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspections.map((inspection) => (
            <TableRow key={inspection.id}>
              <TableCell>
                <Link
                  href={`/qc/${inspection.id}`}
                  className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {inspection.number}
                </Link>
                {inspection.parentNumber ? (
                  <span className="block nums font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    ulang dari {inspection.parentNumber}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                <Link
                  href={`/production/${inspection.productionOrderId}`}
                  className="nums rounded-sm font-mono text-xs underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {inspection.productionOrderNumber}
                </Link>
              </TableCell>
              <TableCell>
                <span className="font-medium">{inspection.productName}</span>
                <span className="nums block font-mono text-[11px] text-muted-foreground">
                  {inspection.variantSku}
                </span>
              </TableCell>
              <TableCell>
                <StageCodeBadge stageCode={inspection.stageCode} />
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
                {inspection.defectCount > 0 ? (
                  <span className="nums mt-1 block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {inspection.defectCount} detail cacat
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="nums font-mono text-xs text-muted-foreground">
                {formatDateTimeId(inspection.inspectedAt)}
                <span className="block">{inspection.inspectedByName ?? "—"}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
