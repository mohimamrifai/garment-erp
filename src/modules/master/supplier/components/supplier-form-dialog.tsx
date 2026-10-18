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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { Supplier } from "../service";
import { supplierFormSchema, type SupplierFormInput } from "../schemas";

type SupplierFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
};

export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(supplier);

  const form = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
      notes: supplier?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && supplier) {
        await requestJson(`/api/v1/master/suppliers/${supplier.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Supplier berhasil diperbarui.");
      } else {
        const created = await requestJson<Supplier>("/api/v1/master/suppliers", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Supplier ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan supplier.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Supplier ${supplier?.code}` : "Tambah Supplier"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi supplier."
              : "Kode supplier dibuat otomatis (format SUP-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="supplier-name">Nama supplier</FieldLabel>
              <Input
                id="supplier-name"
                placeholder="Mis. PT Tekstil Jaya Abadi"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.contactPerson) || undefined}>
                <FieldLabel htmlFor="supplier-contact">Kontak person</FieldLabel>
                <Input
                  id="supplier-contact"
                  aria-invalid={Boolean(errors.contactPerson) || undefined}
                  {...form.register("contactPerson")}
                />
                {errors.contactPerson ? (
                  <FieldError>{errors.contactPerson.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.phone) || undefined}>
                <FieldLabel htmlFor="supplier-phone">Telepon</FieldLabel>
                <Input
                  id="supplier-phone"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  {...form.register("phone")}
                />
                {errors.phone ? <FieldError>{errors.phone.message}</FieldError> : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
              <Input
                id="supplier-email"
                type="email"
                aria-invalid={Boolean(errors.email) || undefined}
                {...form.register("email")}
              />
              {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.address) || undefined}>
              <FieldLabel htmlFor="supplier-address">Alamat</FieldLabel>
              <Textarea
                id="supplier-address"
                rows={2}
                aria-invalid={Boolean(errors.address) || undefined}
                {...form.register("address")}
              />
              {errors.address ? <FieldError>{errors.address.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="supplier-notes">Catatan</FieldLabel>
              <Textarea
                id="supplier-notes"
                rows={2}
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

/** Tombol + dialog untuk menambah supplier baru dari toolbar halaman. */
export function CreateSupplierButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Supplier
      </Button>
      {open ? <SupplierFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
