"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { formatQty } from "@/lib/utils/currency";
import type { LocationOption } from "@/modules/master/warehouse/service";
import { materialReceiptFormSchema, type MaterialReceiptFormInput } from "../schemas";
import type { MaterialReceipt, ReceivablePurchaseOrderOption } from "../service";

export type ReceiptFormItem = {
  purchaseOrderItemId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  orderedQuantity: string;
  /** Sisa yang boleh diterima baik (sudah memperhitungkan draf ini pada mode edit). */
  maxAcceptedQuantity: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  notes: string;
};

type ReceiptFormProps = {
  mode: "create" | "edit";
  locations: LocationOption[];
  /** PO terpilih (wajib diisi oleh server saat mode edit). */
  purchaseOrder?: { id: string; number: string; supplierName: string };
  /** Opsi PO untuk mode create sebelum PO dipilih. */
  purchaseOrderOptions?: ReceivablePurchaseOrderOption[];
  items: ReceiptFormItem[];
  receiptId?: string;
  initial: { receivedAt: string; locationId: string; notes: string };
};

/**
 * Form penerimaan material. Pada mode create, memilih purchase order bernavigasi
 * ke URL `?po=<id>` sehingga item outstanding dimuat ulang dari server.
 */
export function ReceiptForm({
  mode,
  locations,
  purchaseOrder,
  purchaseOrderOptions = [],
  items,
  receiptId,
  initial,
}: ReceiptFormProps) {
  const router = useRouter();

  const form = useForm<MaterialReceiptFormInput>({
    resolver: zodResolver(materialReceiptFormSchema),
    defaultValues: {
      purchaseOrderId: purchaseOrder?.id ?? "",
      receivedAt: initial.receivedAt,
      locationId: initial.locationId,
      notes: initial.notes,
      items: items.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        receivedQuantity: item.receivedQuantity,
        acceptedQuantity: item.acceptedQuantity,
        notes: item.notes,
      })),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.warehouseName} — ${location.code} (${location.name})`,
  }));
  const poOptions = purchaseOrderOptions.map((option) => ({
    value: option.id,
    label: `${option.number} — ${option.supplierName} (sisa ${formatQty(option.remainingQuantity)})`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (mode === "edit" && receiptId) {
        await requestJson(`/api/v1/material-receipts/${receiptId}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Perubahan penerimaan disimpan.");
        router.push(`/purchasing/receipts/${receiptId}`);
        router.refresh();
        return;
      }
      const created = await requestJson<MaterialReceipt>(`/api/v1/material-receipts`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Penerimaan ${created.number} dibuat sebagai draf.`);
      router.push(`/purchasing/receipts/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError
            ? error.message
            : mode === "edit"
              ? "Gagal menyimpan perubahan."
              : "Gagal membuat penerimaan.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Informasi Penerimaan
        </h2>
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <span className="mb-1.5 block text-[13px] font-medium">Purchase Order</span>
            {purchaseOrder ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Link
                  href={`/purchasing/${purchaseOrder.id}`}
                  className="nums rounded-sm font-mono text-[13px] font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {purchaseOrder.number}
                </Link>
                <span className="text-[13px] text-muted-foreground">
                  {purchaseOrder.supplierName}
                </span>
                {mode === "create" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    render={<Link href="/purchasing/receipts/new" />}
                  >
                    <ArrowLeftRight data-icon="inline-start" />
                    Ganti PO
                  </Button>
                ) : null}
              </div>
            ) : (
              <Select
                value={null}
                onValueChange={(next) => router.push(`/purchasing/receipts/new?po=${next}`)}
                items={poOptions}
              >
                <SelectTrigger id="receipt-po" className="w-full">
                  <SelectValue placeholder="Pilih purchase order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {poOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.receivedAt) || undefined}>
            <FieldLabel htmlFor="receipt-date">Tanggal terima</FieldLabel>
            <Input
              id="receipt-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.receivedAt) || undefined}
              {...form.register("receivedAt")}
            />
            {errors.receivedAt ? <FieldError>{errors.receivedAt.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.locationId) || undefined}>
            <FieldLabel htmlFor="receipt-location">Lokasi penyimpanan</FieldLabel>
            <Controller
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next)}
                  items={locationOptions}
                >
                  <SelectTrigger id="receipt-location" className="w-full">
                    <SelectValue placeholder="Pilih lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {locationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.locationId ? <FieldError>{errors.locationId.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-12" data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="receipt-notes">Catatan</FieldLabel>
            <Textarea
              id="receipt-notes"
              rows={2}
              placeholder="Opsional, mis. nomor surat jalan supplier"
              aria-invalid={Boolean(errors.notes) || undefined}
              {...form.register("notes")}
            />
            {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Item Diterima
        </h2>

        {typeof errors.items?.message === "string" ? (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        ) : null}
        {errors.items && !errors.items.message ? (
          <p className="text-sm text-destructive">
            Periksa kembali jumlah pada item — minimal satu item harus diterima baik.
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {purchaseOrder
              ? "Semua item purchase order ini sudah diterima lengkap."
              : "Pilih purchase order untuk memuat item yang belum diterima."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item, index) => {
              const itemErrors = errors.items?.[index];
              const maxAccepted = Number(item.maxAcceptedQuantity);
              return (
                <div key={item.purchaseOrderItemId} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.materialName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {item.materialCode} · {item.unitCode}
                      </span>
                    </div>
                    <span className="nums font-mono text-xs text-muted-foreground">
                      Dipesan {formatQty(item.orderedQuantity)} · Sisa {formatQty(item.maxAcceptedQuantity)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <Field
                      className="sm:col-span-3"
                      data-invalid={Boolean(itemErrors?.receivedQuantity) || undefined}
                    >
                      <FieldLabel htmlFor={`receipt-item-received-${index}`}>
                        Jumlah diterima
                      </FieldLabel>
                      <Input
                        id={`receipt-item-received-${index}`}
                        type="number"
                        min={0}
                        step="any"
                        className="nums font-mono"
                        aria-invalid={Boolean(itemErrors?.receivedQuantity) || undefined}
                        {...form.register(`items.${index}.receivedQuantity`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value)),
                        })}
                      />
                      {itemErrors?.receivedQuantity ? (
                        <FieldError>{itemErrors.receivedQuantity.message}</FieldError>
                      ) : null}
                    </Field>

                    <Field
                      className="sm:col-span-3"
                      data-invalid={Boolean(itemErrors?.acceptedQuantity) || undefined}
                    >
                      <FieldLabel htmlFor={`receipt-item-accepted-${index}`}>
                        Diterima baik
                      </FieldLabel>
                      <Input
                        id={`receipt-item-accepted-${index}`}
                        type="number"
                        min={0}
                        max={maxAccepted}
                        step="any"
                        className="nums font-mono"
                        aria-invalid={Boolean(itemErrors?.acceptedQuantity) || undefined}
                        {...form.register(`items.${index}.acceptedQuantity`, {
                          setValueAs: (value) => (value === "" ? 0 : Number(value)),
                          validate: (value) =>
                            Number(value) <= maxAccepted ||
                            `Maksimal ${formatQty(item.maxAcceptedQuantity)} ${item.unitCode}.`,
                        })}
                      />
                      {itemErrors?.acceptedQuantity ? (
                        <FieldError>{itemErrors.acceptedQuantity.message}</FieldError>
                      ) : null}
                    </Field>

                    <Field className="sm:col-span-6">
                      <FieldLabel htmlFor={`receipt-item-notes-${index}`}>Catatan item</FieldLabel>
                      <Input
                        id={`receipt-item-notes-${index}`}
                        placeholder="Opsional, mis. 2 sak rusak"
                        {...form.register(`items.${index}.notes`)}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Hanya jumlah <span className="font-medium">diterima baik</span> yang menambah stok dan
          mengurangi sisa pesanan. Selisihnya dengan jumlah diterima dianggap retur.
        </p>
      </section>

      <section className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-4">
        <Button
          type="button"
          variant="outline"
          render={
            <Link
              href={
                mode === "edit" && receiptId
                  ? `/purchasing/receipts/${receiptId}`
                  : "/purchasing/receipts"
              }
            />
          }
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting || items.length === 0}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          {mode === "edit" ? "Simpan Perubahan" : "Simpan Draf"}
        </Button>
      </section>
    </form>
  );
}
