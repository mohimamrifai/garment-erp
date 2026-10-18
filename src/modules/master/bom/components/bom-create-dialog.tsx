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
import type { VariantOption } from "@/modules/master/product/service";
import type { Bom } from "../service";
import { bomCreateSchema, type BomCreateInput } from "../schemas";

type BomCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: VariantOption[];
};

export function BomCreateDialog({ open, onOpenChange, variants }: BomCreateDialogProps) {
  const router = useRouter();

  const form = useForm<BomCreateInput>({
    resolver: zodResolver(bomCreateSchema),
    defaultValues: { variantId: "", notes: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const variantItems = variants.map((variant) => ({
    value: variant.id,
    label: `${variant.productName} — ${variant.size}/${variant.color} (${variant.variantSku})`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await requestJson<Bom>(`/api/v1/master/boms`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Draf BOM berhasil dibuat. Tambahkan item material.");
      onOpenChange(false);
      form.reset();
      router.push(`/master/bom/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal membuat BOM.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Buat BOM</DialogTitle>
          <DialogDescription>
            BOM dibuat sebagai draf. Tambahkan material, lalu aktifkan agar menjadi versi yang
            dipakai produksi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.variantId) || undefined}>
              <FieldLabel htmlFor="bom-variant">Varian produk</FieldLabel>
              <Controller
                control={form.control}
                name="variantId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next)}
                    items={variantItems}
                  >
                    <SelectTrigger id="bom-variant" className="w-full">
                      <SelectValue placeholder="Pilih varian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {variantItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.variantId ? <FieldError>{errors.variantId.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="bom-notes">Catatan</FieldLabel>
              <Textarea
                id="bom-notes"
                rows={2}
                placeholder="Opsional, mis. catatan revisi"
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

/** Tombol + dialog untuk membuat BOM baru dari toolbar halaman. */
export function CreateBomButton({ variants }: { variants: VariantOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Buat BOM
      </Button>
      {open ? <BomCreateDialog open variants={variants} onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
