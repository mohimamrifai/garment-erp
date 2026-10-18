"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { Product } from "../service";
import { productFormSchema, type ProductFormInput } from "../schemas";

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
};

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && product) {
        await requestJson(`/api/v1/master/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Produk berhasil diperbarui.");
      } else {
        const created = await requestJson<Product>("/api/v1/master/products", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Produk ${created.sku} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan produk.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Produk ${product?.sku}` : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi produk."
              : "SKU produk dibuat otomatis (format PRD-0001); varian ukuran/warna ditambahkan setelahnya."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="product-name">Nama produk</FieldLabel>
              <Input
                id="product-name"
                placeholder="Mis. Kaos Polo Lengan Pendek"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="product-description">Deskripsi</FieldLabel>
              <Textarea
                id="product-description"
                rows={2}
                placeholder="Opsional, mis. bahan dan model"
                aria-invalid={Boolean(errors.description) || undefined}
                {...form.register("description")}
              />
              {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
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

/** Tombol + dialog untuk menambah produk baru dari toolbar halaman. */
export function CreateProductButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Produk
      </Button>
      {open ? <ProductFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}

/** Tombol ubah produk untuk halaman detail. */
export function EditProductButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil data-icon="inline-start" />
        Ubah Produk
      </Button>
      {open ? (
        <ProductFormDialog open product={product} onOpenChange={(next) => setOpen(next)} />
      ) : null}
    </>
  );
}
