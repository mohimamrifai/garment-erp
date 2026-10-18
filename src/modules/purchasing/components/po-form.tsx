"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { formatIdr, formatQty } from "@/lib/utils/currency";
import type { MaterialOption } from "@/modules/master/material/service";
import type { SupplierOption } from "@/modules/master/supplier/service";
import { purchaseOrderFormSchema, type PurchaseOrderFormInput } from "../schemas";
import type { PurchaseOrder } from "../service";

type PurchaseOrderFormProps = {
  mode: "create" | "edit";
  suppliers: SupplierOption[];
  materials: MaterialOption[];
  purchaseOrderId?: string;
  initial?: PurchaseOrderFormInput;
  /** Info banner di atas form, mis. prefill dari kekurangan material SPK. */
  notice?: string;
};

const emptyItem: PurchaseOrderFormInput["items"][number] = {
  materialId: "",
  orderedQuantity: 1,
  unitPrice: 0,
  notes: "",
};

function materialLabel(material: MaterialOption): string {
  return `${material.name} (${material.code}) — ${material.unitCode}`;
}

/** Satu kartu item pesanan: material, kuantitas, harga beli, catatan. */
function PoItemFields({
  form,
  index,
  materialOptions,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<PurchaseOrderFormInput>;
  index: number;
  materialOptions: { value: string; label: string }[];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { errors } = form.formState;
  const itemErrors = errors.items?.[index];

  const quantity = useWatch({ control: form.control, name: `items.${index}.orderedQuantity` });
  const unitPrice = useWatch({ control: form.control, name: `items.${index}.unitPrice` });
  const subtotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Item {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Hapus item ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        <Field className="sm:col-span-6" data-invalid={Boolean(itemErrors?.materialId) || undefined}>
          <FieldLabel htmlFor={`po-item-material-${index}`}>Material</FieldLabel>
          <Controller
            control={form.control}
            name={`items.${index}.materialId`}
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={(next) => field.onChange(next)}
                items={materialOptions}
              >
                <SelectTrigger id={`po-item-material-${index}`} className="w-full">
                  <SelectValue placeholder="Pilih material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {materialOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {itemErrors?.materialId ? (
            <FieldError>{itemErrors.materialId.message}</FieldError>
          ) : null}
        </Field>

        <Field
          className="sm:col-span-2"
          data-invalid={Boolean(itemErrors?.orderedQuantity) || undefined}
        >
          <FieldLabel htmlFor={`po-item-qty-${index}`}>Kuantitas</FieldLabel>
          <Input
            id={`po-item-qty-${index}`}
            type="number"
            min={0}
            step="any"
            className="nums font-mono"
            aria-invalid={Boolean(itemErrors?.orderedQuantity) || undefined}
            {...form.register(`items.${index}.orderedQuantity`, {
              setValueAs: (value) => (value === "" ? 0 : Number(value)),
            })}
          />
          {itemErrors?.orderedQuantity ? (
            <FieldError>{itemErrors.orderedQuantity.message}</FieldError>
          ) : null}
        </Field>

        <Field className="sm:col-span-4" data-invalid={Boolean(itemErrors?.unitPrice) || undefined}>
          <FieldLabel htmlFor={`po-item-price-${index}`}>Harga beli satuan (Rp)</FieldLabel>
          <Input
            id={`po-item-price-${index}`}
            type="number"
            min={0}
            step={1000}
            className="nums font-mono"
            aria-invalid={Boolean(itemErrors?.unitPrice) || undefined}
            {...form.register(`items.${index}.unitPrice`, {
              setValueAs: (value) => (value === "" ? 0 : Number(value)),
            })}
          />
          {itemErrors?.unitPrice ? <FieldError>{itemErrors.unitPrice.message}</FieldError> : null}
        </Field>

        <Field className="sm:col-span-12">
          <FieldLabel htmlFor={`po-item-notes-${index}`}>Catatan item</FieldLabel>
          <Input
            id={`po-item-notes-${index}`}
            placeholder="Opsional, mis. spesifikasi bahan"
            {...form.register(`items.${index}.notes`)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Subtotal
        </span>
        <span className="nums font-mono text-sm font-medium">{formatIdr(subtotal)}</span>
      </div>
    </div>
  );
}

export function PurchaseOrderForm({
  mode,
  suppliers,
  materials,
  purchaseOrderId,
  initial,
  notice,
}: PurchaseOrderFormProps) {
  const router = useRouter();

  const form = useForm<PurchaseOrderFormInput>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: initial ?? {
      supplierId: "",
      orderDate: "",
      expectedDate: "",
      notes: "",
      items: [{ ...emptyItem }],
    },
  });
  const { errors, isSubmitting } = form.formState;
  const itemsArray = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = useWatch({ control: form.control, name: "items" });

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: `${supplier.name} (${supplier.code})`,
  }));
  const materialOptions = materials.map((material) => ({
    value: material.id,
    label: materialLabel(material),
  }));

  const totals = (watchedItems ?? []).reduce(
    (acc, item) => {
      const quantity = Number(item?.orderedQuantity) || 0;
      const unitPrice = Number(item?.unitPrice) || 0;
      return {
        items: acc.items + 1,
        quantity: acc.quantity + quantity,
        value: acc.value + quantity * unitPrice,
      };
    },
    { items: 0, quantity: 0, value: 0 },
  );

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (mode === "edit" && purchaseOrderId) {
        await requestJson(`/api/v1/purchase-orders/${purchaseOrderId}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Perubahan purchase order disimpan.");
        router.push(`/purchasing/${purchaseOrderId}`);
        router.refresh();
        return;
      }
      const created = await requestJson<PurchaseOrder>(`/api/v1/purchase-orders`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Purchase order ${created.number} dibuat sebagai draf.`);
      router.push(`/purchasing/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError
            ? error.message
            : mode === "edit"
              ? "Gagal menyimpan perubahan."
              : "Gagal membuat purchase order.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
      {notice ? (
        <p className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-[13px]">{notice}</p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Informasi Pesanan
        </h2>
        <div className="grid gap-3 sm:grid-cols-12">
          <Field className="sm:col-span-6" data-invalid={Boolean(errors.supplierId) || undefined}>
            <FieldLabel htmlFor="po-supplier">Supplier</FieldLabel>
            <Controller
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next)}
                  items={supplierOptions}
                >
                  <SelectTrigger id="po-supplier" className="w-full">
                    <SelectValue placeholder="Pilih supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {supplierOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplierId ? <FieldError>{errors.supplierId.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.orderDate) || undefined}>
            <FieldLabel htmlFor="po-order-date">Tanggal pesanan</FieldLabel>
            <Input
              id="po-order-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.orderDate) || undefined}
              {...form.register("orderDate")}
            />
            {errors.orderDate ? <FieldError>{errors.orderDate.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.expectedDate) || undefined}>
            <FieldLabel htmlFor="po-expected-date">Estimasi datang</FieldLabel>
            <Input
              id="po-expected-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.expectedDate) || undefined}
              {...form.register("expectedDate")}
            />
            {errors.expectedDate ? <FieldError>{errors.expectedDate.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-12" data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="po-notes">Catatan</FieldLabel>
            <Textarea
              id="po-notes"
              rows={2}
              placeholder="Opsional, mis. syarat pembayaran atau termin pengiriman"
              aria-invalid={Boolean(errors.notes) || undefined}
              {...form.register("notes")}
            />
            {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Item Pesanan
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => itemsArray.append({ ...emptyItem })}
          >
            <Plus data-icon="inline-start" />
            Tambah Item
          </Button>
        </div>

        {errors.items?.root ? (
          <p className="text-sm text-destructive">{errors.items.root.message}</p>
        ) : null}
        {typeof errors.items?.message === "string" ? (
          <p className="text-sm text-destructive">{errors.items.message}</p>
        ) : null}

        <div className="flex flex-col gap-3">
          {itemsArray.fields.map((field, index) => (
            <PoItemFields
              key={field.id}
              form={form}
              index={index}
              materialOptions={materialOptions}
              canRemove={itemsArray.fields.length > 1}
              onRemove={() => itemsArray.remove(index)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
        <dl className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Total Item
            </dt>
            <dd className="nums font-mono text-sm font-medium">{totals.items}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Total Kuantitas
            </dt>
            <dd className="nums font-mono text-sm font-medium">{formatQty(totals.quantity)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Nilai Pesanan
            </dt>
            <dd className="nums font-mono text-sm font-medium">{formatIdr(totals.value)}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            render={
              <Link
                href={
                  mode === "edit" && purchaseOrderId
                    ? `/purchasing/${purchaseOrderId}`
                    : "/purchasing"
                }
              />
            }
          >
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            {mode === "edit" ? "Simpan Perubahan" : "Simpan Draf"}
          </Button>
        </div>
      </section>
    </form>
  );
}
