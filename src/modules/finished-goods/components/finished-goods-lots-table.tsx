import Link from "next/link";
import { History } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeId } from "@/lib/utils/dates";
import type { FinishedGoodsLotRow } from "../service";

/** Riwayat lot barang jadi terbaru (traceability SPK + inspeksi QC akhir). */
export function FinishedGoodsLotsTable({ lots }: { lots: FinishedGoodsLotRow[] }) {
  if (lots.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>Belum ada lot barang jadi</EmptyTitle>
          <EmptyDescription>
            Setiap inspeksi QC akhir yang lolos menghasilkan satu lot beserta penerimaan stok.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Waktu</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead className="text-right">Kuantitas</TableHead>
            <TableHead>SPK</TableHead>
            <TableHead>Inspeksi QC</TableHead>
            <TableHead>Lokasi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map((lot) => (
            <TableRow key={lot.id}>
              <TableCell className="whitespace-nowrap font-mono text-[12px] text-muted-foreground tabular-nums">
                {formatDateTimeId(lot.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{lot.productName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {lot.variantSku} · {lot.size}/{lot.color}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {Number(lot.quantity).toLocaleString("id-ID")}
              </TableCell>
              <TableCell>
                <Link
                  href={`/production/${lot.productionOrderId}`}
                  className="font-mono text-[12px] underline underline-offset-4 hover:text-foreground"
                >
                  {lot.productionOrderNumber}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/qc/${lot.qcInspectionId}`}
                  className="font-mono text-[12px] underline underline-offset-4 hover:text-foreground"
                >
                  {lot.qcInspectionNumber}
                </Link>
              </TableCell>
              <TableCell className="text-[12px]">
                {lot.warehouseName} / {lot.locationCode}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
