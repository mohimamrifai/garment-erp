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
import type { Warehouse } from "../service";
import { warehouseFormSchema, type WarehouseFormInput } from "../schemas";

type WarehouseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
};

export function WarehouseFormDialog({ open, onOpenChange, warehouse }: WarehouseFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(warehouse);

  const form = useForm<WarehouseFormInput>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: warehouse?.name ?? "",
      address: warehouse?.address ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && warehouse) {
        await requestJson(`/api/v1/master/warehouses/${warehouse.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Gudang berhasil diperbarui.");
      } else {
        const created = await requestJson<Warehouse>("/api/v1/master/warehouses", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Gudang ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan gudang.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Gudang ${warehouse?.code}` : "Tambah Gudang"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi gudang."
              : "Kode gudang dibuat otomatis (format WH-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="warehouse-name">Nama gudang</FieldLabel>
              <Input
                id="warehouse-name"
                placeholder="Mis. Gudang Bahan Baku"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.address) || undefined}>
              <FieldLabel htmlFor="warehouse-address">Alamat / lokasi</FieldLabel>
              <Textarea
                id="warehouse-address"
                rows={2}
                placeholder="Opsional"
                aria-invalid={Boolean(errors.address) || undefined}
                {...form.register("address")}
              />
              {errors.address ? <FieldError>{errors.address.message}</FieldError> : null}
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

/** Tombol + dialog untuk menambah gudang baru dari toolbar halaman. */
export function CreateWarehouseButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Gudang
      </Button>
      {open ? <WarehouseFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
