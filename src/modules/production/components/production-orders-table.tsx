import Link from "next/link";
import { Factory } from "lucide-react";
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
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import type { ProductionOrderListRow } from "../service";
import { SpkStatusBadge } from "./production-badges";

/** Tabel daftar SPK dengan progress output tahap akhir (packing). */
export function ProductionOrdersTable({ orders }: { orders: ProductionOrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Factory />
          </EmptyMedia>
          <EmptyTitle>Belum ada SPK</EmptyTitle>
          <EmptyDescription>
            Buat SPK dari item sales order yang sudah dikonfirmasi untuk memulai produksi.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const today = getTodayDate();

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Nomor SPK</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead className="w-44">Referensi SO</TableHead>
            <TableHead className="w-36">Lini</TableHead>
            <TableHead className="w-28 text-right">Target</TableHead>
            <TableHead className="w-32 text-right">Output</TableHead>
            <TableHead className="w-32">Jatuh Tempo</TableHead>
            <TableHead className="w-40">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const overdue =
              (order.status === "OPEN" || order.status === "IN_PROGRESS") &&
              order.plannedEndDate < today;
            return (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/production/${order.id}`}
                    className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {order.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.productName}</span>
                    <span className="nums font-mono text-[11px] text-muted-foreground">
                      {order.variantSku} · {order.size}/{order.color}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="nums font-mono text-xs text-muted-foreground">
                  {order.salesOrderNumber}
                  <span className="block text-[11px]">{order.buyerName}</span>
                </TableCell>
                <TableCell className="text-[13px]">{order.lineName ?? "—"}</TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatQty(order.plannedQuantity)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatQty(order.outputQuantity)}
                  <span className="text-muted-foreground"> / {formatQty(order.plannedQuantity)}</span>
                </TableCell>
                <TableCell>
                  <span className="nums font-mono text-xs">
                    {formatDateId(order.plannedEndDate)}
                  </span>
                  {overdue ? (
                    <span className="ml-1.5 font-mono text-[10px] tracking-wider text-destructive uppercase">
                      lewat
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <SpkStatusBadge status={order.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
