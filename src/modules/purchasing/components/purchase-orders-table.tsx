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
import { formatIdr, formatQty } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import type { PurchaseOrderListRow } from "../service";
import { canReceivePurchaseOrder } from "../status";
import { PoRowActions } from "./po-row-actions";
import { PoStatusBadge } from "./purchasing-badges";

type PurchaseOrdersTableProps = {
  orders: PurchaseOrderListRow[];
  canUpdate: boolean;
  canOrder: boolean;
  canCancel: boolean;
  canReceive: boolean;
};

export function PurchaseOrdersTable({
  orders,
  canUpdate,
  canOrder,
  canCancel,
  canReceive,
}: PurchaseOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>Belum ada purchase order</EmptyTitle>
          <EmptyDescription>
            Buat purchase order untuk memesan material dari supplier.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const today = getTodayDate();
  const showActions = canUpdate || canOrder || canCancel || canReceive;

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Nomor</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="w-32">Pesanan</TableHead>
            <TableHead className="w-32">Estimasi</TableHead>
            <TableHead className="w-32 text-right">Diterima</TableHead>
            <TableHead className="w-36 text-right">Nilai</TableHead>
            <TableHead className="w-44">Status</TableHead>
            {showActions ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const overdue =
              canReceivePurchaseOrder(order.status) &&
              order.expectedDate !== null &&
              order.expectedDate < today;
            return (
              <TableRow key={order.id}>
                <TableCell>
                  <Link
                    href={`/purchasing/${order.id}`}
                    className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {order.number}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{order.supplierName}</TableCell>
                <TableCell className="nums font-mono text-xs text-muted-foreground">
                  {formatDateId(order.orderDate)}
                </TableCell>
                <TableCell>
                  {order.expectedDate ? (
                    <span className="nums font-mono text-xs">
                      {formatDateId(order.expectedDate)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {overdue ? (
                    <span className="ml-1.5 font-mono text-[10px] tracking-wider text-destructive uppercase">
                      lewat
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatQty(order.totalReceived)}
                  <span className="text-muted-foreground"> / {formatQty(order.totalOrdered)}</span>
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatIdr(order.totalValue)}
                </TableCell>
                <TableCell>
                  <PoStatusBadge status={order.status} />
                </TableCell>
                {showActions ? (
                  <TableCell className="text-right">
                    <PoRowActions
                      order={{
                        id: order.id,
                        number: order.number,
                        status: order.status,
                      }}
                      canUpdate={canUpdate}
                      canOrder={canOrder}
                      canCancel={canCancel}
                      canReceive={canReceive}
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
