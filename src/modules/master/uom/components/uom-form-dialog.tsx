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
import type { Uom } from "../service";
import { uomFormSchema, type UomFormInput } from "../schemas";

type UomFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uom?: Uom;
};

export function UomFormDialog({ open, onOpenChange, uom }: UomFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(uom);

  const form = useForm<UomFormInput>({
    resolver: zodResolver(uomFormSchema),
    defaultValues: {
      code: uom?.code ?? "",
      name: uom?.name ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && uom) {
        await requestJson(`/api/v1/master/uoms/${uom.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: values.name }),
        });
        toast.success("Satuan berhasil diperbarui.");
      } else {
        const created = await requestJson<Uom>("/api/v1/master/uoms", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Satuan ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan satuan.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Satuan ${uom?.code}` : "Tambah Satuan"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Kode satuan tidak dapat diubah setelah dibuat."
              : "Kode diisi manual (huruf besar), mis. PCS, MTR, KG, ROLL."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.code) || undefined}>
              <FieldLabel htmlFor="uom-code">Kode</FieldLabel>
              <Input
                id="uom-code"
                placeholder="Mis. PCS"
                className="font-mono uppercase"
                disabled={isEdit}
                aria-invalid={Boolean(errors.code) || undefined}
                {...form.register("code")}
              />
              {errors.code ? <FieldError>{errors.code.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="uom-name">Nama satuan</FieldLabel>
              <Input
                id="uom-name"
                placeholder="Mis. Pieces, Meter, Kilogram"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
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

/** Tombol + dialog untuk menambah satuan baru dari toolbar halaman. */
export function CreateUomButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Satuan
      </Button>
      {open ? <UomFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
