import Link from "next/link";
import { CircleCheck, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId } from "@/lib/utils/dates";
import type { OrderFulfillment } from "../service";
import { AllocationDialog } from "./allocation-dialog";
import { ShipmentStatusBadge } from "./shipment-status-badge";

type OrderFulfillmentSectionProps = {
  fulfillment: OrderFulfillment;
  canAllocate: boolean;
  canCreateShipment: boolean;
};

/**
 * Bagian pemenuhan pada detail sales order: sisa per item, alokasi barang jadi,
 * dan riwayat surat jalan.
 */
export function OrderFulfillmentSection({
  fulfillment,
  canAllocate,
  canCreateShipment,
}: OrderFulfillmentSectionProps) {
  const { totals } = fulfillment;
  const hasAllocations = totals.allocatedQuantity > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="size-4 text-muted-foreground" aria-hidden />
                Pemenuhan & Pengiriman
              </CardTitle>
              <CardDescription>
                Dipesan {totals.orderedQuantity.toLocaleString("id-ID")} · terkirim{" "}
                {totals.shippedQuantity.toLocaleString("id-ID")} · teralokasi{" "}
                {totals.allocatedQuantity.toLocaleString("id-ID")} · sisa{" "}
                {totals.remainingQuantity.toLocaleString("id-ID")} unit.
              </CardDescription>
            </div>
            {canCreateShipment && fulfillment.canShip ? (
              <Button
                nativeButton={false}
                render={<Link href={`/shipping/new?so=${fulfillment.order.id}`} />}
              >
                <Truck data-icon="inline-start" />
                Buat Pengiriman
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {fulfillment.isFullyAllocated && totals.remainingQuantity > 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-[13px] text-success">
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              Seluruh sisa pesanan sudah dialokasikan dan siap dibuatkan pengiriman.
            </p>
          ) : totals.unallocatedQuantity > 0 && totals.remainingQuantity > 0 ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] text-warning">
              {totals.unallocatedQuantity.toLocaleString("id-ID")} unit sisa pesanan belum
              dialokasikan ke barang jadi.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Dipesan</TableHead>
                  <TableHead className="text-right">Terkirim</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead className="text-right">Teralokasi</TableHead>
                  <TableHead className="text-right">Tersedia FG</TableHead>
                  {canAllocate ? <TableHead className="text-right">Aksi</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fulfillment.items.map((item) => (
                  <TableRow key={item.salesOrderItemId}>
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
                    <TableCell className="text-right font-mono tabular-nums">
                      {item.shippedQuantity.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {item.remainingQuantity.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {item.allocatedQuantity.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {item.availableQuantity > 0 ? (
                        item.availableQuantity.toLocaleString("id-ID")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canAllocate ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {item.unallocatedQuantity > 0 &&
                          item.locations.some((location) => location.availableQuantity > 0) ? (
                            <AllocationDialog
                              salesOrderId={fulfillment.order.id}
                              item={item}
                              mode="allocate"
                            />
                          ) : null}
                          {item.allocatedQuantity > 0 ? (
                            <AllocationDialog
                              salesOrderId={fulfillment.order.id}
                              item={item}
                              mode="release"
                            />
                          ) : null}
                          {item.unallocatedQuantity === 0 && item.allocatedQuantity === 0 ? (
                            <span className="text-[12px] text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {totals.orderedQuantity.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {totals.shippedQuantity.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {totals.remainingQuantity.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {totals.allocatedQuantity.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell />
                  {canAllocate ? <TableCell /> : null}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengiriman</CardTitle>
          <CardDescription>
            {hasAllocations
              ? "Alokasi berkurang otomatis saat surat jalan diposting."
              : "Belum ada alokasi aktif untuk pesanan ini."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fulfillment.shipments.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-[13px] text-muted-foreground">
              Belum ada surat jalan untuk pesanan ini.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Nomor SJ</TableHead>
                    <TableHead>Tanggal Kirim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Kuantitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fulfillment.shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>
                        <Link
                          href={`/shipping/${shipment.id}`}
                          className="font-mono text-[12px] font-medium underline underline-offset-4 hover:text-brand-strong"
                        >
                          {shipment.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {formatDateId(shipment.shippedAt)}
                      </TableCell>
                      <TableCell>
                        <ShipmentStatusBadge status={shipment.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {shipment.totalQuantity.toLocaleString("id-ID")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
