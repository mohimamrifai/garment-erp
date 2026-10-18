import Link from "next/link";
import { PackageCheck } from "lucide-react";
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
import { formatDateId } from "@/lib/utils/dates";
import type { MaterialReceiptListRow } from "../service";
import { ReceiptRowActions } from "./receipt-row-actions";
import { ReceiptStatusBadge } from "./purchasing-badges";

type ReceiptsTableProps = {
  receipts: MaterialReceiptListRow[];
  canUpdate: boolean;
  canPost: boolean;
  canCancel: boolean;
};

export function ReceiptsTable({ receipts, canUpdate, canPost, canCancel }: ReceiptsTableProps) {
  if (receipts.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <PackageCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada penerimaan material</EmptyTitle>
          <EmptyDescription>
            Catat penerimaan barang dari purchase order untuk menambah stok gudang.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const showActions = canUpdate || canPost || canCancel;

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Nomor</TableHead>
            <TableHead className="w-40">Purchase Order</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="w-32">Terima</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead className="w-32 text-right">Diterima</TableHead>
            <TableHead className="w-32 text-right">Baik</TableHead>
            <TableHead className="w-36">Status</TableHead>
            {showActions ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id}>
              <TableCell>
                <Link
                  href={`/purchasing/receipts/${receipt.id}`}
                  className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {receipt.number}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/purchasing/${receipt.purchaseOrderId}`}
                  className="nums rounded-sm font-mono text-[13px] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {receipt.purchaseOrderNumber}
                </Link>
              </TableCell>
              <TableCell className="font-medium">{receipt.supplierName}</TableCell>
              <TableCell className="nums font-mono text-xs text-muted-foreground">
                {formatDateId(receipt.receivedAt)}
              </TableCell>
              <TableCell className="text-[13px]">
                {receipt.locationName}
                <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {receipt.locationCode} · {receipt.warehouseName}
                </span>
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatQty(receipt.totalReceived)}
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatQty(receipt.totalAccepted)}
              </TableCell>
              <TableCell>
                <ReceiptStatusBadge status={receipt.status} />
              </TableCell>
              {showActions ? (
                <TableCell className="text-right">
                  <ReceiptRowActions
                    receipt={{
                      id: receipt.id,
                      number: receipt.number,
                      status: receipt.status,
                    }}
                    canUpdate={canUpdate}
                    canPost={canPost}
                    canCancel={canCancel}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
