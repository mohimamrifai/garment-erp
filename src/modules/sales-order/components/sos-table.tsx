import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr, formatNumber } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import { isActiveSoStatus } from "../status";
import type { SalesOrderListRow } from "../service";
import { SoRowActions } from "./so-row-actions";
import { SoStatusBadge } from "./so-status-badge";

type SosTableProps = {
  orders: SalesOrderListRow[];
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
};

export function SosTable({ orders, canUpdate, canConfirm, canCancel }: SosTableProps) {
  if (orders.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>Belum ada sales order</EmptyTitle>
          <EmptyDescription>
            Buat pesanan untuk buyer, lalu konfirmasi agar siap masuk produksi.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const today = getTodayDate();
  const showActions = canUpdate || canConfirm || canCancel;

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Nomor</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead className="w-28">Pesanan</TableHead>
            <TableHead className="w-32">Tenggat</TableHead>
            <TableHead className="w-16 text-right">Item</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-36 text-right">Nilai</TableHead>
            <TableHead className="w-40">Status</TableHead>
            {showActions ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const overdue = isActiveSoStatus(order.status) && order.dueDate < today;
            return (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/sales/${order.id}`}
                    className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {order.number}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{order.buyerName}</TableCell>
                <TableCell className="nums font-mono text-xs text-muted-foreground">
                  {formatDateId(order.orderDate)}
                </TableCell>
                <TableCell>
                  <span className="nums font-mono text-xs">{formatDateId(order.dueDate)}</span>
                  {overdue ? (
                    <span className="ml-1.5 font-mono text-[10px] tracking-wider text-destructive uppercase">
                      lewat
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatNumber(order.itemCount)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatNumber(order.totalQuantity)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatIdr(order.totalValue)}
                </TableCell>
                <TableCell>
                  <SoStatusBadge status={order.status} />
                </TableCell>
                {showActions ? (
                  <TableCell className="text-right">
                    <SoRowActions
                      order={order}
                      canUpdate={canUpdate}
                      canConfirm={canConfirm}
                      canCancel={canCancel}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
