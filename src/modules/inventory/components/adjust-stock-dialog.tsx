"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import type { MaterialOption } from "@/modules/master/material/service";
import type { VariantOption } from "@/modules/master/product/service";
import type { LocationOption } from "@/modules/master/warehouse/service";
import { adjustStockSchema, type AdjustStockInput } from "../schemas";

type AdjustStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kunci anti penggandaan per pembukaan dialog (dari induk). */
  clientKey: string;
  materials: MaterialOption[];
  variants: VariantOption[];
  locations: LocationOption[];
};

/** Dialog penyesuaian stok (opname/koreksi) dengan alasan wajib. */
export function AdjustStockDialog({
  open,
  onOpenChange,
  clientKey,
  materials,
  variants,
  locations,
}: AdjustStockDialogProps) {
  const router = useRouter();

  const form = useForm<AdjustStockInput>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      direction: "IN",
      itemType: "MATERIAL",
      materialId: "",
      variantId: "",
      locationId: "",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const itemType = useWatch({ control: form.control, name: "itemType" });

  const materialOptions = materials.map((material) => ({
    value: material.id,
    label: `${material.name} (${material.code}) — ${material.unitCode}`,
  }));
  const variantOptions = variants.map((variant) => ({
    value: variant.id,
    label: `${variant.productName} — ${variant.size}/${variant.color} (${variant.variantSku})`,
  }));
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.warehouseName} — ${location.code} (${location.name})`,
  }));
  const itemOptions = itemType === "MATERIAL" ? materialOptions : variantOptions;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/inventory/adjustments`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          materialId: values.itemType === "MATERIAL" ? values.materialId : "",
          variantId: values.itemType === "FINISHED_GOOD" ? values.variantId : "",
          idempotencyKey: clientKey,
        }),
      });
      toast.success("Penyesuaian stok tercatat.");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyesuaikan stok.",
      });
    }
  });

  function changeItemType(next: "MATERIAL" | "FINISHED_GOOD") {
    form.setValue("itemType", next);
    form.setValue("materialId", "");
    form.setValue("variantId", "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok</DialogTitle>
          <DialogDescription>
            Koreksi saldo karena hasil opname, barang rusak, atau selisih lain. Alasan wajib diisi
            dan tercatat di audit log.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.direction) || undefined}>
                <FieldLabel htmlFor="adjust-direction">Arah</FieldLabel>
                <Controller
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(next) => field.onChange(next)}
                      items={[
                        { value: "IN", label: "Masuk (menambah stok)" },
                        { value: "OUT", label: "Keluar (mengurangi stok)" },
                      ]}
                    >
                      <SelectTrigger id="adjust-direction" className="w-full">
                        <SelectValue placeholder="Pilih arah" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="IN">Masuk (menambah stok)</SelectItem>
                          <SelectItem value="OUT">Keluar (mengurangi stok)</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.direction ? <FieldError>{errors.direction.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.itemType) || undefined}>
                <FieldLabel htmlFor="adjust-item-type">Tipe item</FieldLabel>
                <Select
                  value={itemType}
                  onValueChange={(next) => changeItemType(next as "MATERIAL" | "FINISHED_GOOD")}
                  items={[
                    { value: "MATERIAL", label: "Material" },
                    { value: "FINISHED_GOOD", label: "Barang Jadi" },
                  ]}
                >
                  <SelectTrigger id="adjust-item-type" className="w-full">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="MATERIAL">Material</SelectItem>
                      <SelectItem value="FINISHED_GOOD">Barang Jadi</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              data-invalid={
                Boolean(itemType === "MATERIAL" ? errors.materialId : errors.variantId) || undefined
              }
            >
              <FieldLabel htmlFor="adjust-item">
                {itemType === "MATERIAL" ? "Material" : "Varian produk"}
              </FieldLabel>
              <Controller
                control={form.control}
                name={itemType === "MATERIAL" ? "materialId" : "variantId"}
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next)}
                    items={itemOptions}
                  >
                    <SelectTrigger id="adjust-item" className="w-full">
                      <SelectValue
                        placeholder={
                          itemType === "MATERIAL" ? "Pilih material" : "Pilih varian produk"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {itemOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {itemType === "MATERIAL" && errors.materialId ? (
                <FieldError>{errors.materialId.message}</FieldError>
              ) : null}
              {itemType === "FINISHED_GOOD" && errors.variantId ? (
                <FieldError>{errors.variantId.message}</FieldError>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.locationId) || undefined}>
                <FieldLabel htmlFor="adjust-location">Lokasi</FieldLabel>
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      onValueChange={(next) => field.onChange(next)}
                      items={locationOptions}
                    >
                      <SelectTrigger id="adjust-location" className="w-full">
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

              <Field data-invalid={Boolean(errors.quantity) || undefined}>
                <FieldLabel htmlFor="adjust-quantity">Kuantitas</FieldLabel>
                <Input
                  id="adjust-quantity"
                  type="number"
                  min={0}
                  step="any"
                  className="nums font-mono"
                  aria-invalid={Boolean(errors.quantity) || undefined}
                  {...form.register("quantity", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                />
                {errors.quantity ? <FieldError>{errors.quantity.message}</FieldError> : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.reason) || undefined}>
              <FieldLabel htmlFor="adjust-reason">Alasan</FieldLabel>
              <Textarea
                id="adjust-reason"
                rows={2}
                placeholder="mis. hasil opname mingguan — selisih 5 meter"
                aria-invalid={Boolean(errors.reason) || undefined}
                {...form.register("reason")}
              />
              {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="adjust-notes">Catatan tambahan</FieldLabel>
              <Textarea
                id="adjust-notes"
                rows={2}
                placeholder="Opsional"
                aria-invalid={Boolean(errors.notes) || undefined}
                {...form.register("notes")}
              />
              {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Catat Penyesuaian
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
