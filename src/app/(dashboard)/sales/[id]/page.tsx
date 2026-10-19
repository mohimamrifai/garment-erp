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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatIdr, formatNumber } from "@/lib/utils/currency";
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { SoDetailActions } from "@/modules/sales-order/components/so-detail-actions";
import { SoStatusBadge } from "@/modules/sales-order/components/so-status-badge";
import { getSalesOrderDetail } from "@/modules/sales-order/service";
import { OrderFulfillmentSection } from "@/modules/shipping/components/order-fulfillment-section";
import { getSalesOrderFulfillment } from "@/modules/shipping/service";

export const metadata: Metadata = { title: "Detail Sales Order" };

type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function SalesOrderDetailPage({ params }: SalesOrderDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<SalesOrderDetailSkeleton />}>
        <SalesOrderDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function SalesOrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function SalesOrderDetailSection({ params }: SalesOrderDetailPageProps) {
  const actor = await requirePagePermission("so.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getSalesOrderDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { order, buyer, items, totals } = detail;
  const fulfillment = await getSalesOrderFulfillment(order.id);
  const fulfillmentByItem = new Map(
    fulfillment.items.map((item) => [item.salesOrderItemId, item]),
  );
  const canViewShipping = can(actor.roles, "shipment.view");
  const canAllocate = can(actor.roles, "fg.allocate");
  const canCreateShipment = can(actor.roles, "shipment.create");

  return (
    <>
      <PageHeader
        title={order.number}
        description={`${buyer.name} (${buyer.code}) · ${totals.itemCount} item`}
        actions={
          <>
            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Daftar SO
            </Link>
            <SoDetailActions
              salesOrderId={order.id}
              number={order.number}
              status={order.status}
              canUpdate={can(actor.roles, "so.update")}
              canConfirm={can(actor.roles, "so.confirm")}
              canCancel={can(actor.roles, "so.cancel")}
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
            <SoStatusBadge status={order.status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Buyer
          </dt>
          <dd className="text-sm font-medium">{buyer.name}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tanggal Pesanan
          </dt>
          <dd className="nums font-mono text-sm">{formatDateId(order.orderDate)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tenggat
          </dt>
          <dd className="nums font-mono text-sm">{formatDateId(order.dueDate)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibuat
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {formatDateTimeId(order.createdAt)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dikonfirmasi
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {order.confirmedAt ? formatDateTimeId(order.confirmedAt) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibatalkan
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {order.cancelledAt ? formatDateTimeId(order.cancelledAt) : "—"}
          </dd>
        </div>
        {order.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-3">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Catatan
            </dt>
            <dd className="text-sm">{order.notes}</dd>
          </div>
        ) : null}
      </dl>

      {order.status === "CANCELLED" && order.cancelReason ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px]">
          <span className="font-medium text-destructive">Pesanan dibatalkan.</span>{" "}
          <span className="text-muted-foreground">{order.cancelReason}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Item Pesanan
          </h2>
          <p className="text-xs text-muted-foreground">
            Terkirim dihitung dari surat jalan yang sudah diposting.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Varian</TableHead>
                <TableHead className="w-24 text-right">Dipesan</TableHead>
                <TableHead className="w-24 text-right">Terkirim</TableHead>
                <TableHead className="w-24 text-right">Sisa</TableHead>
                <TableHead className="w-32 text-right">Harga Satuan</TableHead>
                <TableHead className="w-36 text-right">Subtotal</TableHead>
                <TableHead className="w-28">Tenggat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const line = fulfillmentByItem.get(item.id);
                const shipped = line?.shippedQuantity ?? 0;
                const remaining = line?.remainingQuantity ?? item.quantity;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.productName}</span>
                        <span className="nums font-mono text-[11px] text-muted-foreground">
                          {item.variantSku} · {item.size}/{item.color}
                        </span>
                        {item.notes ? (
                          <span className="mt-0.5 text-xs text-muted-foreground">{item.notes}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatNumber(shipped)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatNumber(remaining)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatIdr(item.unitPrice)}
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {formatIdr(item.quantity * Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="nums font-mono text-xs text-muted-foreground">
                      {formatDateId(item.dueDate ?? order.dueDate)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">
                  {totals.itemCount} item
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatNumber(totals.totalQuantity)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatNumber(totals.shippedQuantity)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatNumber(totals.totalQuantity - totals.shippedQuantity)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Total</TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatIdr(totals.totalValue)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      {canViewShipping ? (
        <OrderFulfillmentSection
          fulfillment={fulfillment}
          canAllocate={canAllocate}
          canCreateShipment={canCreateShipment}
        />
      ) : null}
    </>
  );
}
