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
import type { WarehouseLocation } from "../service";
import { locationFormSchema, type LocationFormInput } from "../schemas";

type LocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseCode: string;
  location?: WarehouseLocation;
};

export function LocationFormDialog({
  open,
  onOpenChange,
  warehouseId,
  warehouseCode,
  location,
}: LocationFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(location);

  const form = useForm<LocationFormInput>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      code: location?.code ?? "",
      name: location?.name ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && location) {
        await requestJson(`/api/v1/master/locations/${location.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Lokasi berhasil diperbarui.");
      } else {
        const created = await requestJson<WarehouseLocation>(
          `/api/v1/master/warehouses/${warehouseId}/locations`,
          {
            method: "POST",
            body: JSON.stringify(values),
          },
        );
        toast.success(`Lokasi ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan lokasi.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Ubah Lokasi ${location?.code}` : "Tambah Lokasi"}
          </DialogTitle>
          <DialogDescription>
            Kode lokasi unik per gudang ({warehouseCode}), mis. A-01, RAK-2.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.code) || undefined}>
              <FieldLabel htmlFor="location-code">Kode lokasi</FieldLabel>
              <Input
                id="location-code"
                placeholder="Mis. A-01"
                className="font-mono uppercase"
                aria-invalid={Boolean(errors.code) || undefined}
                {...form.register("code")}
              />
              {errors.code ? <FieldError>{errors.code.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="location-name">Nama lokasi</FieldLabel>
              <Input
                id="location-name"
                placeholder="Mis. Rak A baris 1"
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

/** Tombol + dialog untuk menambah lokasi baru dari halaman detail gudang. */
export function CreateLocationButton({
  warehouseId,
  warehouseCode,
}: {
  warehouseId: string;
  warehouseCode: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Lokasi
      </Button>
      {open ? (
        <LocationFormDialog
          open
          warehouseId={warehouseId}
          warehouseCode={warehouseCode}
          onOpenChange={(next) => setOpen(next)}
        />
      ) : null}
    </>
  );
}
