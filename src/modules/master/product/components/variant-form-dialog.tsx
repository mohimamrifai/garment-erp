"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { ProductVariant } from "../service";
import { variantFormSchema, type VariantFormInput } from "../schemas";

type VariantFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productSku: string;
  /** Bila diberikan, dialog dalam mode ubah. */
  variant?: ProductVariant;
};

export function VariantFormDialog({
  open,
  onOpenChange,
  productId,
  productSku,
  variant,
}: VariantFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(variant);

  const form = useForm<VariantFormInput>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: {
      size: variant?.size ?? "",
      color: variant?.color ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && variant) {
        await requestJson(`/api/v1/master/variants/${variant.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Varian berhasil diperbarui.");
      } else {
        const created = await requestJson<ProductVariant>(
          `/api/v1/master/products/${productId}/variants`,
          {
            method: "POST",
            body: JSON.stringify(values),
          },
        );
        toast.success(`Varian ${created.variantSku} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan varian.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Ubah Varian ${variant?.variantSku}` : "Tambah Varian"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perubahan ukuran/warna juga memperbarui SKU varian."
              : `SKU varian dibuat otomatis dari SKU produk (${productSku}) + ukuran + warna.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.size) || undefined}>
                <FieldLabel htmlFor="variant-size">Ukuran</FieldLabel>
                <Input
                  id="variant-size"
                  placeholder="Mis. M / L / XL"
                  className="font-mono uppercase"
                  aria-invalid={Boolean(errors.size) || undefined}
                  {...form.register("size")}
                />
                {errors.size ? <FieldError>{errors.size.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.color) || undefined}>
                <FieldLabel htmlFor="variant-color">Warna</FieldLabel>
                <Input
                  id="variant-color"
                  placeholder="Mis. Black / Navy"
                  aria-invalid={Boolean(errors.color) || undefined}
                  {...form.register("color")}
                />
                {errors.color ? <FieldError>{errors.color.message}</FieldError> : null}
              </Field>
            </div>
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

/** Tombol + dialog untuk menambah varian baru dari halaman detail produk. */
export function CreateVariantButton({
  productId,
  productSku,
}: {
  productId: string;
  productSku: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Varian
      </Button>
      {open ? (
        <VariantFormDialog
          open
          productId={productId}
          productSku={productSku}
          onOpenChange={(next) => setOpen(next)}
        />
      ) : null}
    </>
  );
}
