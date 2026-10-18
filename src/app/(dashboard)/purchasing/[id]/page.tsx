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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api/errors";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatIdr, formatQty } from "@/lib/utils/currency";
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { PoDetailActions } from "@/modules/purchasing/components/po-detail-actions";
import { PoStatusBadge, ReceiptStatusBadge } from "@/modules/purchasing/components/purchasing-badges";
import { getPurchaseOrderDetail } from "@/modules/purchasing/service";

export const metadata: Metadata = { title: "Detail Purchase Order" };

type PurchaseOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PurchaseOrderDetailSkeleton />}>
        <PurchaseOrderDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function PurchaseOrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function PurchaseOrderDetailSection({ params }: PurchaseOrderDetailPageProps) {
  const actor = await requirePagePermission("po.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getPurchaseOrderDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { order, supplier, items, receipts, totals } = detail;

  return (
    <>
      <PageHeader
        title={order.number}
        description={`${supplier.name} (${supplier.code}) · ${totals.itemCount} item`}
        actions={
          <>
            <Link
              href="/purchasing"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Daftar PO
            </Link>
            <PoDetailActions
              purchaseOrderId={order.id}
              number={order.number}
              status={order.status}
              canUpdate={can(actor.roles, "po.update")}
              canOrder={can(actor.roles, "po.order")}
              canCancel={can(actor.roles, "po.cancel")}
              canReceive={can(actor.roles, "receipt.create")}
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
            <PoStatusBadge status={order.status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Supplier
          </dt>
          <dd className="text-sm font-medium">{supplier.name}</dd>
          {supplier.contactPerson || supplier.phone ? (
            <dd className="text-xs text-muted-foreground">
              {[supplier.contactPerson, supplier.phone].filter(Boolean).join(" · ")}
            </dd>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Tanggal Pesanan
          </dt>
          <dd className="nums font-mono text-sm">{formatDateId(order.orderDate)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Estimasi Datang
          </dt>
          <dd className="nums font-mono text-sm">
            {order.expectedDate ? formatDateId(order.expectedDate) : "—"}
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
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dipesan
          </dt>
          <dd className="nums font-mono text-xs text-muted-foreground">
            {order.orderedAt ? formatDateTimeId(order.orderedAt) : "—"}
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
          <span className="font-medium text-destructive">PO dibatalkan.</span>{" "}
          <span className="text-muted-foreground">{order.cancelReason}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Item Pesanan
        </h2>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-28 text-right">Dipesan</TableHead>
                <TableHead className="w-28 text-right">Diterima</TableHead>
                <TableHead className="w-28 text-right">Sisa</TableHead>
                <TableHead className="w-32 text-right">Harga Satuan</TableHead>
                <TableHead className="w-36 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.materialName}</span>
                      <span className="nums font-mono text-[11px] text-muted-foreground">
                        {item.materialCode} · {item.unitCode}
                        {item.notes ? <span> · {item.notes}</span> : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.orderedQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.acceptedQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(item.remainingQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatIdr(item.unitPrice)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatIdr(Number(item.orderedQuantity) * Number(item.unitPrice))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(totals.totalOrdered)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(totals.totalAccepted)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(totals.totalOrdered - totals.totalAccepted)}
                </TableCell>
                <TableCell />
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatIdr(totals.totalValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Riwayat Penerimaan
        </h2>

        {receipts.length === 0 ? (
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyTitle>Belum ada penerimaan</EmptyTitle>
              <EmptyDescription>
                Penerimaan barang akan tampil di sini beserta lokasi penyimpanannya.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Nomor</TableHead>
                  <TableHead className="w-32">Tanggal Terima</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="w-24 text-right">Item</TableHead>
                  <TableHead className="w-32 text-right">Diterima</TableHead>
                  <TableHead className="w-32 text-right">Baik</TableHead>
                  <TableHead className="w-36">Status</TableHead>
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
                    <TableCell className="nums font-mono text-xs text-muted-foreground">
                      {formatDateId(receipt.receivedAt)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {receipt.locationName}
                      <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                        {receipt.locationCode}
                      </span>
                    </TableCell>
                    <TableCell className="nums text-right font-mono text-sm">
                      {receipt.itemCount}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
