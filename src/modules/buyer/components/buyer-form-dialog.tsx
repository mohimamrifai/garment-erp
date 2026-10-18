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
import type { Buyer } from "../service";
import { buyerFormSchema, type BuyerFormInput } from "../schemas";

type BuyerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bila diberikan, dialog dalam mode ubah. */
  buyer?: Buyer;
};

export function BuyerFormDialog({ open, onOpenChange, buyer }: BuyerFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(buyer);

  const form = useForm<BuyerFormInput>({
    resolver: zodResolver(buyerFormSchema),
    defaultValues: {
      name: buyer?.name ?? "",
      contactPerson: buyer?.contactPerson ?? "",
      phone: buyer?.phone ?? "",
      email: buyer?.email ?? "",
      address: buyer?.address ?? "",
      notes: buyer?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && buyer) {
        await requestJson(`/api/v1/buyers/${buyer.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Buyer berhasil diperbarui.");
      } else {
        const created = await requestJson<Buyer>("/api/v1/buyers", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Buyer ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan buyer.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Buyer ${buyer?.code}` : "Tambah Buyer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui informasi buyer." : "Kode buyer dibuat otomatis (format BUY-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="buyer-name">Nama buyer</FieldLabel>
              <Input
                id="buyer-name"
                placeholder="Mis. PT Maju Garmen Sejahtera"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.contactPerson) || undefined}>
                <FieldLabel htmlFor="buyer-contact">Kontak person</FieldLabel>
                <Input
                  id="buyer-contact"
                  aria-invalid={Boolean(errors.contactPerson) || undefined}
                  {...form.register("contactPerson")}
                />
                {errors.contactPerson ? (
                  <FieldError>{errors.contactPerson.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.phone) || undefined}>
                <FieldLabel htmlFor="buyer-phone">Telepon</FieldLabel>
                <Input
                  id="buyer-phone"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  {...form.register("phone")}
                />
                {errors.phone ? <FieldError>{errors.phone.message}</FieldError> : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.email) || undefined}>
              <FieldLabel htmlFor="buyer-email">Email</FieldLabel>
              <Input
                id="buyer-email"
                type="email"
                aria-invalid={Boolean(errors.email) || undefined}
                {...form.register("email")}
              />
              {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.address) || undefined}>
              <FieldLabel htmlFor="buyer-address">Alamat</FieldLabel>
              <Textarea
                id="buyer-address"
                rows={2}
                aria-invalid={Boolean(errors.address) || undefined}
                {...form.register("address")}
              />
              {errors.address ? <FieldError>{errors.address.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="buyer-notes">Catatan</FieldLabel>
              <Textarea
                id="buyer-notes"
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

/** Tombol + dialog untuk menambah buyer baru dari toolbar halaman. */
export function CreateBuyerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Buyer
      </Button>
      {open ? <BuyerFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
