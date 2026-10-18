"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import type { Material } from "../service";
import { materialFormSchema, type MaterialFormInput } from "../schemas";

export type UomOption = { id: string; code: string; name: string };

type MaterialFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: Material;
  uoms: UomOption[];
};

export function MaterialFormDialog({ open, onOpenChange, material, uoms }: MaterialFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(material);

  const form = useForm<MaterialFormInput>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: {
      name: material?.name ?? "",
      unitId: material?.unitId ?? "",
      minimumStock: material ? Number(material.minimumStock) : 0,
      notes: material?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const uomItems = uoms.map((uom) => ({
    value: uom.id,
    label: `${uom.code} — ${uom.name}`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && material) {
        await requestJson(`/api/v1/master/materials/${material.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Material berhasil diperbarui.");
      } else {
        const created = await requestJson<Material>("/api/v1/master/materials", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Material ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan material.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Material ${material?.code}` : "Tambah Material"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi material."
              : "Kode material dibuat otomatis (format MAT-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="material-name">Nama material</FieldLabel>
              <Input
                id="material-name"
                placeholder="Mis. Kain Cotton Combed 30s"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.unitId) || undefined}>
                <FieldLabel htmlFor="material-unit">Satuan</FieldLabel>
                <Controller
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      onValueChange={(next) => field.onChange(next)}
                      items={uomItems}
                    >
                      <SelectTrigger id="material-unit" className="w-full">
                        <SelectValue placeholder="Pilih satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {uomItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unitId ? <FieldError>{errors.unitId.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.minimumStock) || undefined}>
                <FieldLabel htmlFor="material-min-stock">Stok minimum</FieldLabel>
                <Input
                  id="material-min-stock"
                  type="number"
                  min={0}
                  step="0.001"
                  className="nums font-mono"
                  aria-invalid={Boolean(errors.minimumStock) || undefined}
                  {...form.register("minimumStock", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                />
                {errors.minimumStock ? (
                  <FieldError>{errors.minimumStock.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="material-notes">Catatan</FieldLabel>
              <Textarea
                id="material-notes"
                rows={2}
                placeholder="Opsional, mis. spesifikasi atau warna kain"
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
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Tombol + dialog untuk menambah material baru dari toolbar halaman. */
export function CreateMaterialButton({ uoms }: { uoms: UomOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Material
      </Button>
      {open ? (
        <MaterialFormDialog open uoms={uoms} onOpenChange={(next) => setOpen(next)} />
      ) : null}
    </>
  );
}
