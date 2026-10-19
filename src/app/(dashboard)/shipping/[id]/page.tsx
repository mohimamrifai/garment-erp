import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDateId, formatDateTimeId } from "@/lib/utils/dates";
import { ShipmentDetailActions } from "@/modules/shipping/components/shipment-detail-actions";
import { ShipmentStatusBadge } from "@/modules/shipping/components/shipment-status-badge";
import { getShipmentDetail } from "@/modules/shipping/service";

export const metadata: Metadata = { title: "Detail Pengiriman" };

type ShipmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ShipmentDetailSkeleton />}>
        <ShipmentDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function ShipmentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

async function ShipmentDetailSection({ params }: ShipmentDetailPageProps) {
  const actor = await requirePagePermission("shipment.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getShipmentDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const canPost = can(actor.roles, "shipment.post");
  const canCancel = can(actor.roles, "shipment.cancel");

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          href="/shipping"
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Kembali ke pengiriman
        </Link>
        <PageHeader
          title={detail.shipment.number}
          description={`Surat jalan untuk ${detail.order.number} — ${detail.buyer.name}.`}
          actions={
            <ShipmentDetailActions
              shipmentId={detail.shipment.id}
              number={detail.shipment.number}
              status={detail.shipment.status}
              canPost={canPost}
              canCancel={canCancel}
            />
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Truck className="size-4 text-muted-foreground" aria-hidden />
                Informasi Pengiriman
                <ShipmentStatusBadge status={detail.shipment.status} />
              </CardTitle>
              <CardDescription>
                {detail.shipment.status === "DRAFT"
                  ? "Draf belum mengurangi stok. Posting untuk mengeluarkan barang jadi."
                  : detail.shipment.status === "POSTED"
                    ? "Stok barang jadi telah dikurangi dan alokasi item dilepas."
                    : "Pengiriman dibatalkan; tidak ada pergerakan stok."}
              </CardDescription>
            </div>
            <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              <InfoRow label="Tanggal kirim" value={formatDateId(detail.shipment.shippedAt)} />
              <InfoRow label="Lokasi asal" value={`${detail.location.warehouseName} / ${detail.location.code}`} />
              <InfoRow
                label="Sales order"
                value={
                  <Link
                    href={`/sales/${detail.order.id}`}
                    className="font-mono underline underline-offset-4 hover:text-foreground"
                  >
                    {detail.order.number}
                  </Link>
                }
              />
              <InfoRow label="Buyer" value={detail.buyer.name} />
              <InfoRow label="Dibuat oleh" value={detail.createdByName ?? "—"} />
              <InfoRow
                label="Diposting"
                value={
                  detail.shipment.postedAt
                    ? `${formatDateTimeId(detail.shipment.postedAt)}${detail.postedByName ? ` · ${detail.postedByName}` : ""}`
                    : "—"
                }
              />
            </div>
          </div>
        </CardHeader>
        {detail.shipment.notes || detail.shipment.cancelReason ? (
          <CardContent className="flex flex-col gap-2 border-t pt-4">
            {detail.shipment.notes ? (
              <p className="text-[13px]">
                <span className="text-muted-foreground">Catatan: </span>
                {detail.shipment.notes}
              </p>
            ) : null}
            {detail.shipment.cancelReason ? (
              <p className="text-[13px] text-destructive">
                <span className="text-muted-foreground">Alasan batal: </span>
                {detail.shipment.cancelReason}
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Pengiriman</CardTitle>
          <CardDescription>
            Kuantitas per item pesanan. Total {detail.totals.totalQuantity.toLocaleString("id-ID")}{" "}
            unit dalam {detail.totals.itemCount} baris.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Dipesan</TableHead>
                  <TableHead className="text-right">Dikirim</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.productName}</span>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {item.variantSku} · {item.size}/{item.color}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {item.orderedQuantity.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {item.quantity.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {item.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {detail.totals.totalQuantity.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button variant="outline" nativeButton={false} render={<Link href="/shipping" />}>
          <ArrowLeft data-icon="inline-start" />
          Daftar Pengiriman
        </Button>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
