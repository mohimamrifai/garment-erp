"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { OrderFulfillmentItem, OrderFulfillmentLocation } from "../service";

type AllocationDialogProps = {
  salesOrderId: string;
  item: OrderFulfillmentItem;
  mode: "allocate" | "release";
};

function maxForLocation(
  mode: "allocate" | "release",
  item: OrderFulfillmentItem,
  location: OrderFulfillmentLocation | undefined,
): number {
  if (!location) return 0;
  return mode === "allocate"
    ? Math.max(0, Math.min(item.unallocatedQuantity, location.availableQuantity))
    : location.allocatedQuantity;
}

/**
 * Dialog alokasi/pelepasan barang jadi untuk satu item pesanan. Lokasi hanya
 * yang memiliki stok tersedia (alokasi) atau alokasi aktif (pelepasan).
 */
export function AllocationDialog({ salesOrderId, item, mode }: AllocationDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={mode === "allocate" ? "outline" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {mode === "allocate" ? "Alokasikan" : "Lepas"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <AllocationDialogContent
            salesOrderId={salesOrderId}
            item={item}
            mode={mode}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function AllocationDialogContent({
  salesOrderId,
  item,
  mode,
  onClose,
}: AllocationDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const locations =
    mode === "allocate"
      ? item.locations.filter((location) => location.availableQuantity > 0)
      : item.locations.filter((location) => location.allocatedQuantity > 0);
  const first = locations[0];

  const [locationId, setLocationId] = useState(first?.locationId ?? "");
  const [quantity, setQuantity] = useState(() => {
    const initial = maxForLocation(mode, item, first);
    return initial > 0 ? String(initial) : "";
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const locationOptions = locations.map((location) => ({
    value: location.locationId,
    label: `${location.warehouseName} — ${location.locationCode} · ${
      mode === "allocate" ? "tersedia" : "dialokasikan"
    } ${
      (mode === "allocate" ? location.availableQuantity : location.allocatedQuantity).toLocaleString(
        "id-ID",
      )
    }`,
  }));

  const selectedLocation = locations.find((location) => location.locationId === locationId);
  const max = maxForLocation(mode, item, selectedLocation);

  function changeLocation(next: string | null) {
    setLocationId(next ?? "");
    const location = locations.find((row) => row.locationId === next);
    const nextMax = maxForLocation(mode, item, location);
    setQuantity(nextMax > 0 ? String(nextMax) : "");
  }

  async function submit() {
    setError(null);
    const parsed = Number(quantity);
    if (!locationId) {
      setError("Pilih lokasi barang jadi.");
      return;
    }
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("Kuantitas minimal 1.");
      return;
    }
    if (parsed > max) {
      setError(
        mode === "allocate"
          ? `Maksimal alokasi di lokasi ini ${max.toLocaleString("id-ID")} unit.`
          : `Hanya ${max.toLocaleString("id-ID")} unit yang dialokasikan di lokasi ini.`,
      );
      return;
    }

    setPending(true);
    try {
      await requestJson(
        mode === "allocate"
          ? `/api/v1/sales-orders/${salesOrderId}/allocations`
          : `/api/v1/sales-orders/${salesOrderId}/allocations/release`,
        {
          method: "POST",
          body: JSON.stringify({
            salesOrderItemId: item.salesOrderItemId,
            locationId,
            quantity: parsed,
            ...(mode === "release" && reason.trim() ? { reason: reason.trim() } : {}),
          }),
        },
      );
      toast.success(
        mode === "allocate"
          ? `Alokasi ${parsed.toLocaleString("id-ID")} unit untuk ${item.variantSku} dicatat.`
          : `Alokasi ${parsed.toLocaleString("id-ID")} unit untuk ${item.variantSku} dilepas.`,
      );
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Gagal memproses alokasi barang jadi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === "allocate" ? "Alokasikan Barang Jadi" : "Lepas Alokasi"}
        </DialogTitle>
        <DialogDescription>
          {item.productName} · {item.variantSku} — sisa pesanan{" "}
          {item.remainingQuantity.toLocaleString("id-ID")} unit, belum dialokasikan{" "}
          {item.unallocatedQuantity.toLocaleString("id-ID")} unit.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="allocation-location">Lokasi</FieldLabel>
          <Select value={locationId} onValueChange={changeLocation} items={locationOptions}>
            <SelectTrigger id="allocation-location" className="w-full">
              <SelectValue
                placeholder={
                  mode === "allocate" ? "Tidak ada stok tersedia" : "Tidak ada alokasi aktif"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {locations.map((location) => (
                  <SelectItem key={location.locationId} value={location.locationId}>
                    {location.warehouseName} — {location.locationCode}
                    {mode === "allocate"
                      ? ` · tersedia ${location.availableQuantity.toLocaleString("id-ID")}`
                      : ` · dialokasikan ${location.allocatedQuantity.toLocaleString("id-ID")}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="allocation-quantity">Kuantitas</FieldLabel>
          <Input
            id="allocation-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="font-mono tabular-nums"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        {mode === "release" ? (
          <Field>
            <FieldLabel htmlFor="allocation-reason">Catatan (opsional)</FieldLabel>
            <Textarea
              id="allocation-reason"
              rows={2}
              maxLength={300}
              placeholder="mis. stok dialihkan ke pesanan lain"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={pending || locations.length === 0}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {mode === "allocate" ? "Alokasikan" : "Lepas Alokasi"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
