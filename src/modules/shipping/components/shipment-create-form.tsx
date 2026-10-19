"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatDateId } from "@/lib/utils/dates";
import { SoStatusBadge } from "@/modules/sales-order/components/so-status-badge";
import type { OrderFulfillment, OrderFulfillmentItem, ShippableOrderOption } from "../service";

type ShipmentCreateFormProps = {
  orders: ShippableOrderOption[];
  defaultSalesOrderId?: string;
  today: string;
};

type LocationChoice = { value: string; label: string };

/** Batas kirim per item di satu lokasi: sisa pesanan vs stok tersedia + alokasi. */
function maxAtLocation(item: OrderFulfillmentItem, locationId: string): number {
  const location = item.locations.find((row) => row.locationId === locationId);
  const usable = (location?.availableQuantity ?? 0) + (location?.allocatedQuantity ?? 0);
  return Math.max(0, Math.min(item.remainingQuantity, usable));
}

function locationChoices(fulfillment: OrderFulfillment): LocationChoice[] {
  const map = new Map<string, LocationChoice>();
  for (const item of fulfillment.items) {
    for (const location of item.locations) {
      if (location.availableQuantity + location.allocatedQuantity <= 0) continue;
      map.set(location.locationId, {
        value: location.locationId,
        label: `${location.warehouseName} — ${location.locationCode} · ${location.locationName}`,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function bestLocation(fulfillment: OrderFulfillment): string {
  const choices = locationChoices(fulfillment);
  if (choices.length === 0) return "";
  let best = choices[0]!.value;
  let bestScore = -1;
  for (const choice of choices) {
    const score = fulfillment.items.reduce(
      (sum, item) => sum + maxAtLocation(item, choice.value),
      0,
    );
    if (score > bestScore) {
      best = choice.value;
      bestScore = score;
    }
  }
  return best;
}

function prefillQuantities(
  fulfillment: OrderFulfillment,
  locationId: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!locationId) return result;
  for (const item of fulfillment.items) {
    const max = maxAtLocation(item, locationId);
    if (max > 0) result[item.salesOrderItemId] = String(max);
  }
  return result;
}

/**
 * Form surat jalan (F5 task 5.4): pilih pesanan → muat pemenuhan → isi kuantitas
 * per item. Pengiriman disimpan sebagai draf; stok berkurang saat diposting.
 */
export function ShipmentCreateForm({
  orders,
  defaultSalesOrderId,
  today,
}: ShipmentCreateFormProps) {
  const router = useRouter();
  const initialOrderId =
    defaultSalesOrderId && orders.some((order) => order.id === defaultSalesOrderId)
      ? defaultSalesOrderId
      : "";

  const [salesOrderId, setSalesOrderId] = useState(initialOrderId);
  const [fulfillment, setFulfillment] = useState<OrderFulfillment | null>(null);
  const [loading, setLoading] = useState(Boolean(initialOrderId));
  const [locationId, setLocationId] = useState("");
  const [shippedAt, setShippedAt] = useState(today);
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!salesOrderId) return;

    let cancelled = false;
    requestJson<OrderFulfillment>(`/api/v1/sales-orders/${salesOrderId}/fulfillment`)
      .then((data) => {
        if (cancelled) return;
        setFulfillment(data);
        const location = bestLocation(data);
        setLocationId(location);
        setQuantities(prefillQuantities(data, location));
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof ApiRequestError
            ? error.message
            : "Gagal memuat data pemenuhan pesanan.",
        );
        setFulfillment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [salesOrderId]);

  const locations = useMemo(
    () => (fulfillment ? locationChoices(fulfillment) : []),
    [fulfillment],
  );

  const orderOptions = orders.map((order) => ({
    value: order.id,
    label: `${order.number} · ${order.buyerName} · sisa ${order.remainingQuantity.toLocaleString("id-ID")}`,
  }));

  function changeLocation(nextLocationId: string) {
    setLocationId(nextLocationId);
    if (fulfillment) setQuantities(prefillQuantities(fulfillment, nextLocationId));
  }

  function changeQuantity(itemId: string, raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    setQuantities((current) => ({ ...current, [itemId]: digits }));
  }

  const lines = (fulfillment?.items ?? [])
    .map((item) => ({
      item,
      quantity: Number(quantities[item.salesOrderItemId] ?? "0"),
    }))
    .filter((line) => line.quantity > 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function submit() {
    if (!fulfillment) {
      toast.error("Pilih sales order terlebih dahulu.");
      return;
    }
    if (!locationId) {
      toast.error("Belum ada lokasi dengan stok barang jadi untuk pesanan ini.");
      return;
    }
    if (!shippedAt) {
      toast.error("Tanggal pengiriman wajib diisi.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Isi minimal satu kuantitas pengiriman.");
      return;
    }
    for (const line of lines) {
      const max = maxAtLocation(line.item, locationId);
      if (line.quantity > max) {
        toast.error(
          `Kuantitas ${line.item.variantSku} melebihi batas ${max.toLocaleString("id-ID")} unit.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const shipment = await requestJson<{ id: string; number: string }>("/api/v1/shipments", {
        method: "POST",
        body: JSON.stringify({
          salesOrderId: fulfillment.order.id,
          locationId,
          shippedAt,
          notes: notes.trim() || undefined,
          items: lines.map((line) => ({
            salesOrderItemId: line.item.salesOrderItemId,
            quantity: line.quantity,
          })),
        }),
      });
      toast.success(`Pengiriman ${shipment.number} dibuat sebagai draf.`);
      router.push(`/shipping/${shipment.id}`);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : "Gagal membuat pengiriman.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum ada pesanan yang dapat dikirim</CardTitle>
          <CardDescription>
            Pesanan harus berstatus dikonfirmasi, siap kirim, atau terkirim sebagian dan masih
            memiliki sisa kuantitas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/sales" />}>
            Buka Sales Order
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pesanan & Lokasi</CardTitle>
          <CardDescription>
            Pengiriman dapat dilakukan bertahap selama masih ada sisa pesanan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="shipment-order">Sales order</FieldLabel>
              <Select
                value={salesOrderId}
                onValueChange={(next) => {
                  const nextId = next ?? "";
                  if (nextId === salesOrderId) return;
                  setSalesOrderId(nextId);
                  setFulfillment(null);
                  setLocationId("");
                  setQuantities({});
                  setLoading(Boolean(nextId));
                }}
                items={orderOptions}
              >
                <SelectTrigger id="shipment-order" className="w-full">
                  <SelectValue placeholder="Pilih sales order yang akan dikirim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.number} · {order.buyerName} · sisa{" "}
                        {order.remainingQuantity.toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="shipment-date">Tanggal pengiriman</FieldLabel>
              <Input
                id="shipment-date"
                type="date"
                value={shippedAt}
                onChange={(event) => setShippedAt(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="shipment-location">Lokasi barang jadi</FieldLabel>
              <Select
                value={locationId}
                onValueChange={(next) => changeLocation(next ?? "")}
                items={locations}
              >
                <SelectTrigger id="shipment-location" className="w-full">
                  <SelectValue
                    placeholder={
                      loading ? "Memuat lokasi..." : "Tidak ada stok barang jadi tersedia"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {locations.map((location) => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Hanya barang jadi yang sudah lolos QC akhir dan tersedia di lokasi ini.
              </FieldDescription>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="shipment-notes">Catatan (opsional)</FieldLabel>
              <Textarea
                id="shipment-notes"
                rows={2}
                maxLength={500}
                placeholder="mis. dikirim dengan ekspedisi internal"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat pemenuhan pesanan...
          </CardContent>
        </Card>
      ) : fulfillment ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{fulfillment.order.number}</span>
                  <SoStatusBadge status={fulfillment.order.status} />
                </CardTitle>
                <CardDescription>
                  {fulfillment.order.buyerName} · tenggat {formatDateId(fulfillment.order.dueDate)}
                </CardDescription>
              </div>
              <div className="text-right text-[12px] text-muted-foreground">
                <p>
                  Sisa pesanan{" "}
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {fulfillment.totals.remainingQuantity.toLocaleString("id-ID")}
                  </span>
                </p>
                <p>
                  Sudah dialokasikan{" "}
                  <span className="font-mono tabular-nums">
                    {fulfillment.totals.allocatedQuantity.toLocaleString("id-ID")}
                  </span>
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Dipesan</TableHead>
                    <TableHead className="text-right">Terkirim</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-right">Maks. di Lokasi</TableHead>
                    <TableHead className="w-32 text-right">Kirim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fulfillment.items.map((item) => {
                    const max = locationId ? maxAtLocation(item, locationId) : 0;
                    const value = quantities[item.salesOrderItemId] ?? "";
                    return (
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
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.remainingQuantity.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {max > 0 ? (
                            max.toLocaleString("id-ID")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={max}
                            value={value}
                            disabled={max <= 0}
                            onChange={(event) =>
                              changeQuantity(item.salesOrderItemId, event.target.value)
                            }
                            aria-label={`Kuantitas kirim ${item.variantSku}`}
                            className="h-8 text-right font-mono tabular-nums"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {lines.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] text-warning">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                Belum ada kuantitas yang diisi. Isi minimal satu item untuk melanjutkan.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                Pengiriman disimpan sebagai <strong>draf</strong>. Stok berkurang saat diposting
                di halaman detail.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-muted-foreground">
                  Total kirim{" "}
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {totalQuantity.toLocaleString("id-ID")}
                  </span>
                </span>
                <Button onClick={submit} disabled={submitting || lines.length === 0}>
                  {submitting ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Truck data-icon="inline-start" />
                  )}
                  Simpan Draf
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : salesOrderId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Data pemenuhan tidak tersedia. Muat ulang halaman atau pilih pesanan lain.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
