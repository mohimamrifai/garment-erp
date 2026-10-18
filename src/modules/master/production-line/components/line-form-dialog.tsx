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
import type { ProductionLine } from "../service";
import { lineFormSchema, type LineFormInput } from "../schemas";

type LineFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line?: ProductionLine;
};

export function LineFormDialog({ open, onOpenChange, line }: LineFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(line);

  const form = useForm<LineFormInput>({
    resolver: zodResolver(lineFormSchema),
    defaultValues: {
      name: line?.name ?? "",
      notes: line?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && line) {
        await requestJson(`/api/v1/master/lines/${line.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Lini produksi berhasil diperbarui.");
      } else {
        const created = await requestJson<ProductionLine>("/api/v1/master/lines", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Lini produksi ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError ? error.message : "Gagal menyimpan lini produksi.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Ubah Lini ${line?.code}` : "Tambah Lini Produksi"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi lini produksi."
              : "Kode lini dibuat otomatis (format LIN-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="line-name">Nama lini</FieldLabel>
              <Input
                id="line-name"
                placeholder="Mis. Lini 1 — Kaos"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="line-notes">Catatan</FieldLabel>
              <Textarea
                id="line-notes"
                rows={2}
                placeholder="Opsional, mis. kapasitas harian"
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

/** Tombol + dialog untuk menambah lini produksi baru dari toolbar halaman. */
export function CreateLineButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Lini
      </Button>
      {open ? <LineFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
