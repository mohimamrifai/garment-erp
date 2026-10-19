import Link from "next/link";
import { Truck } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId } from "@/lib/utils/dates";
import type { ShipmentListRow } from "../service";
import { ShipmentStatusBadge } from "./shipment-status-badge";

/** Tabel daftar surat jalan. */
export function ShipmentsTable({ shipments }: { shipments: ShipmentListRow[] }) {
  if (shipments.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Truck />
          </EmptyMedia>
          <EmptyTitle>Belum ada pengiriman</EmptyTitle>
          <EmptyDescription>
            Buat surat jalan dari pesanan yang sudah siap kirim atau terkirim sebagian.
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
            <TableHead>Nomor SJ</TableHead>
            <TableHead>Tanggal Kirim</TableHead>
            <TableHead>Sales Order</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Item</TableHead>
            <TableHead className="text-right">Kuantitas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id}>
              <TableCell>
                <Link
                  href={`/shipping/${shipment.id}`}
                  className="font-mono text-[12px] font-medium underline underline-offset-4 hover:text-brand-strong"
                >
                  {shipment.number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-[13px]">
                {formatDateId(shipment.shippedAt)}
              </TableCell>
              <TableCell>
                <Link
                  href={`/sales/${shipment.salesOrderId}`}
                  className="font-mono text-[12px] underline underline-offset-4 hover:text-foreground"
                >
                  {shipment.salesOrderNumber}
                </Link>
              </TableCell>
              <TableCell>{shipment.buyerName}</TableCell>
              <TableCell>
                <ShipmentStatusBadge status={shipment.status} />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {shipment.itemCount}
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {shipment.totalQuantity.toLocaleString("id-ID")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
