"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { MaterialListRow } from "@/modules/master/material/service";
import { bomItemFormSchema, type BomItemFormInput } from "../schemas";

type BomItemFormProps = {
  bomId: string;
  materials: Pick<MaterialListRow, "id" | "code" | "name" | "unitCode">[];
};

/** Form inline untuk menambah item material ke BOM draf. */
export function BomItemForm({ bomId, materials }: BomItemFormProps) {
  const router = useRouter();

  const form = useForm<BomItemFormInput>({
    resolver: zodResolver(bomItemFormSchema),
    defaultValues: { materialId: "", quantityPerUnit: 1, scrapAllowance: 0, notes: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const materialItems = materials.map((material) => ({
    value: material.id,
    label: `${material.code} — ${material.name} (${material.unitCode})`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/master/boms/${bomId}/items`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Item BOM berhasil ditambahkan.");
      form.reset({ materialId: "", quantityPerUnit: 1, scrapAllowance: 0, notes: "" });
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menambah item.",
      });
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Tambah item material</h2>
        <p className="text-xs text-muted-foreground">
          Kebutuhan per unit varian, plus cadangan (scrap allowance) bila perlu.
        </p>
      </div>

      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-12">
        <Field
          className="sm:col-span-5"
          data-invalid={Boolean(errors.materialId) || undefined}
        >
          <FieldLabel htmlFor="bom-item-material">Material</FieldLabel>
          <Controller
            control={form.control}
            name="materialId"
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={(next) => field.onChange(next)}
                items={materialItems}
              >
                <SelectTrigger id="bom-item-material" className="w-full">
                  <SelectValue placeholder="Pilih material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {materialItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {errors.materialId ? <FieldError>{errors.materialId.message}</FieldError> : null}
        </Field>

        <Field
          className="sm:col-span-2"
          data-invalid={Boolean(errors.quantityPerUnit) || undefined}
        >
          <FieldLabel htmlFor="bom-item-qty">Per unit</FieldLabel>
          <Input
            id="bom-item-qty"
            type="number"
            min={0.0001}
            step="0.0001"
            className="nums font-mono"
            aria-invalid={Boolean(errors.quantityPerUnit) || undefined}
            {...form.register("quantityPerUnit", {
              setValueAs: (value) => (value === "" ? 0 : Number(value)),
            })}
          />
          {errors.quantityPerUnit ? (
            <FieldError>{errors.quantityPerUnit.message}</FieldError>
          ) : null}
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(errors.scrapAllowance) || undefined}>
          <FieldLabel htmlFor="bom-item-scrap">Cadangan</FieldLabel>
          <Input
            id="bom-item-scrap"
            type="number"
            min={0}
            step="0.0001"
            className="nums font-mono"
            aria-invalid={Boolean(errors.scrapAllowance) || undefined}
            {...form.register("scrapAllowance", {
              setValueAs: (value) => (value === "" ? 0 : Number(value)),
            })}
          />
          {errors.scrapAllowance ? (
            <FieldError>{errors.scrapAllowance.message}</FieldError>
          ) : null}
        </Field>

        <Field className="sm:col-span-3">
          <FieldLabel htmlFor="bom-item-notes">Catatan</FieldLabel>
          <Input id="bom-item-notes" placeholder="Opsional" {...form.register("notes")} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Tambah Item
        </Button>
      </div>
    </form>
  );
}
