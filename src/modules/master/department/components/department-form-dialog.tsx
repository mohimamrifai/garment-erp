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
import type { Department } from "../service";
import { departmentFormSchema, type DepartmentFormInput } from "../schemas";

type DepartmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bila diberikan, dialog dalam mode ubah. */
  department?: Department;
};

export function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
}: DepartmentFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(department);

  const form = useForm<DepartmentFormInput>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: department?.name ?? "",
      description: department?.description ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && department) {
        await requestJson(`/api/v1/master/departments/${department.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Departemen berhasil diperbarui.");
      } else {
        const created = await requestJson<Department>("/api/v1/master/departments", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Departemen ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan departemen.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Ubah Departemen ${department?.code}` : "Tambah Departemen"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi departemen."
              : "Kode departemen dibuat otomatis (format DEP-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="department-name">Nama departemen</FieldLabel>
              <Input
                id="department-name"
                placeholder="Mis. Cutting, Sewing, Finishing"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="department-description">Deskripsi</FieldLabel>
              <Textarea
                id="department-description"
                rows={2}
                placeholder="Opsional"
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

/** Tombol + dialog untuk menambah departemen baru dari toolbar halaman. */
export function CreateDepartmentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Departemen
      </Button>
      {open ? <DepartmentFormDialog open onOpenChange={(next) => setOpen(next)} /> : null}
    </>
  );
}
