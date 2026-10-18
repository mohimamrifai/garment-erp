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
import { formatIdr } from "@/lib/utils/currency";
import type { VariantOption } from "@/modules/master/product/service";
import type { BuyerOption } from "@/modules/buyer/service";
import { salesOrderFormSchema, type SalesOrderFormInput } from "../schemas";
import type { SalesOrder } from "../service";

type SalesOrderFormProps = {
  mode: "create" | "edit";
  buyers: BuyerOption[];
  variants: VariantOption[];
  salesOrderId?: string;
  initial?: SalesOrderFormInput;
};

const emptyItem: SalesOrderFormInput["items"][number] = {
  variantId: "",
  quantity: 1,
  unitPrice: 0,
  dueDate: "",
  notes: "",
};

function variantLabel(variant: VariantOption): string {
  return `${variant.productName} — ${variant.size}/${variant.color} (${variant.variantSku})`;
}

/** Satu kartu item pesanan: varian, kuantitas, harga, tenggat, catatan. */
function SoItemFields({
  form,
  index,
  variantOptions,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<SalesOrderFormInput>;
  index: number;
  variantOptions: { value: string; label: string }[];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { errors } = form.formState;
  const itemErrors = errors.items?.[index];

  const quantity = useWatch({ control: form.control, name: `items.${index}.quantity` });
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
        <Field className="sm:col-span-6" data-invalid={Boolean(itemErrors?.variantId) || undefined}>
          <FieldLabel htmlFor={`so-item-variant-${index}`}>Varian</FieldLabel>
          <Controller
            control={form.control}
            name={`items.${index}.variantId`}
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={(next) => field.onChange(next)}
                items={variantOptions}
              >
                <SelectTrigger id={`so-item-variant-${index}`} className="w-full">
                  <SelectValue placeholder="Pilih varian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {variantOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {itemErrors?.variantId ? (
            <FieldError>{itemErrors.variantId.message}</FieldError>
          ) : null}
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(itemErrors?.quantity) || undefined}>
          <FieldLabel htmlFor={`so-item-qty-${index}`}>Kuantitas</FieldLabel>
          <Input
            id={`so-item-qty-${index}`}
            type="number"
            min={1}
            step={1}
            className="nums font-mono"
            aria-invalid={Boolean(itemErrors?.quantity) || undefined}
            {...form.register(`items.${index}.quantity`, {
              setValueAs: (value) => (value === "" ? 0 : Number(value)),
            })}
          />
          {itemErrors?.quantity ? <FieldError>{itemErrors.quantity.message}</FieldError> : null}
        </Field>

        <Field className="sm:col-span-4" data-invalid={Boolean(itemErrors?.unitPrice) || undefined}>
          <FieldLabel htmlFor={`so-item-price-${index}`}>Harga satuan (Rp)</FieldLabel>
          <Input
            id={`so-item-price-${index}`}
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

        <Field className="sm:col-span-6" data-invalid={Boolean(itemErrors?.dueDate) || undefined}>
          <FieldLabel htmlFor={`so-item-due-${index}`}>Tenggat item</FieldLabel>
          <Input
            id={`so-item-due-${index}`}
            type="date"
            className="nums font-mono"
            aria-invalid={Boolean(itemErrors?.dueDate) || undefined}
            {...form.register(`items.${index}.dueDate`)}
          />
          <p className="text-xs text-muted-foreground">Kosong = ikut tenggat pesanan.</p>
          {itemErrors?.dueDate ? <FieldError>{itemErrors.dueDate.message}</FieldError> : null}
        </Field>

        <Field className="sm:col-span-6">
          <FieldLabel htmlFor={`so-item-notes-${index}`}>Catatan item</FieldLabel>
          <Input
            id={`so-item-notes-${index}`}
            placeholder="Opsional, mis. warna khusus"
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

export function SalesOrderForm({
  mode,
  buyers,
  variants,
  salesOrderId,
  initial,
}: SalesOrderFormProps) {
  const router = useRouter();

  const form = useForm<SalesOrderFormInput>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: initial ?? {
      buyerId: "",
      orderDate: "",
      dueDate: "",
      notes: "",
      items: [{ ...emptyItem }],
    },
  });
  const { errors, isSubmitting } = form.formState;
  const itemsArray = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = useWatch({ control: form.control, name: "items" });

  const buyerItems = buyers.map((buyer) => ({
    value: buyer.id,
    label: `${buyer.name} (${buyer.code})`,
  }));
  const variantOptions = variants.map((variant) => ({
    value: variant.id,
    label: variantLabel(variant),
  }));

  const totals = (watchedItems ?? []).reduce(
    (acc, item) => {
      const quantity = Number(item?.quantity) || 0;
      const unitPrice = Number(item?.unitPrice) || 0;
      return {
        quantity: acc.quantity + quantity,
        value: acc.value + quantity * unitPrice,
      };
    },
    { quantity: 0, value: 0 },
  );

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (mode === "edit" && salesOrderId) {
        await requestJson(`/api/v1/sales-orders/${salesOrderId}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Perubahan sales order disimpan.");
        router.push(`/sales/${salesOrderId}`);
        router.refresh();
        return;
      }
      const created = await requestJson<SalesOrder>(`/api/v1/sales-orders`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Sales order ${created.number} dibuat sebagai draf.`);
      router.push(`/sales/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError
            ? error.message
            : mode === "edit"
              ? "Gagal menyimpan perubahan."
              : "Gagal membuat sales order.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Informasi Pesanan
        </h2>
        <div className="grid gap-3 sm:grid-cols-12">
          <Field
            className="sm:col-span-6"
            data-invalid={Boolean(errors.buyerId) || undefined}
          >
            <FieldLabel htmlFor="so-buyer">Buyer</FieldLabel>
            <Controller
              control={form.control}
              name="buyerId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next)}
                  items={buyerItems}
                >
                  <SelectTrigger id="so-buyer" className="w-full">
                    <SelectValue placeholder="Pilih buyer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {buyerItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.buyerId ? <FieldError>{errors.buyerId.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.orderDate) || undefined}>
            <FieldLabel htmlFor="so-order-date">Tanggal pesanan</FieldLabel>
            <Input
              id="so-order-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.orderDate) || undefined}
              {...form.register("orderDate")}
            />
            {errors.orderDate ? <FieldError>{errors.orderDate.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.dueDate) || undefined}>
            <FieldLabel htmlFor="so-due-date">Tenggat</FieldLabel>
            <Input
              id="so-due-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.dueDate) || undefined}
              {...form.register("dueDate")}
            />
            {errors.dueDate ? <FieldError>{errors.dueDate.message}</FieldError> : null}
          </Field>

          <Field className="sm:col-span-12" data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="so-notes">Catatan</FieldLabel>
            <Textarea
              id="so-notes"
              rows={2}
              placeholder="Opsional, mis. instruksi khusus dari buyer"
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

        <div className="flex flex-col gap-3">
          {itemsArray.fields.map((field, index) => (
            <SoItemFields
              key={field.id}
              form={form}
              index={index}
              variantOptions={variantOptions}
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
            <dd className="nums font-mono text-sm font-medium">{itemsArray.fields.length}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Total Kuantitas
            </dt>
            <dd className="nums font-mono text-sm font-medium">{totals.quantity}</dd>
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
            render={<Link href={mode === "edit" && salesOrderId ? `/sales/${salesOrderId}` : "/sales"} />}
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
