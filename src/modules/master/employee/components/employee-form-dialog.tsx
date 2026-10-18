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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { Employee } from "../service";
import { employeeFormSchema, type EmployeeFormInput } from "../schemas";

export type DepartmentOption = { id: string; code: string; name: string };

type EmployeeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  departments: DepartmentOption[];
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
}: EmployeeFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(employee);

  const form = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: employee?.name ?? "",
      departmentId: employee?.departmentId ?? "",
      jobTitle: employee?.jobTitle ?? "",
      phone: employee?.phone ?? "",
      email: employee?.email ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const departmentItems = departments.map((department) => ({
    value: department.id,
    label: `${department.name} (${department.code})`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && employee) {
        await requestJson(`/api/v1/master/employees/${employee.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Karyawan berhasil diperbarui.");
      } else {
        const created = await requestJson<Employee>("/api/v1/master/employees", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success(`Karyawan ${created.code} berhasil dibuat.`);
      }
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan karyawan.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Karyawan ${employee?.code}` : "Tambah Karyawan"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi karyawan."
              : "Kode karyawan dibuat otomatis (format EMP-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="employee-name">Nama lengkap</FieldLabel>
              <Input
                id="employee-name"
                placeholder="Mis. Budi Santoso"
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.departmentId) || undefined}>
                <FieldLabel htmlFor="employee-department">Departemen</FieldLabel>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      onValueChange={(next) => field.onChange(next)}
                      items={departmentItems}
                    >
                      <SelectTrigger id="employee-department" className="w-full">
                        <SelectValue placeholder="Pilih departemen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {departmentItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.departmentId ? (
                  <FieldError>{errors.departmentId.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.jobTitle) || undefined}>
                <FieldLabel htmlFor="employee-job-title">Jabatan</FieldLabel>
                <Input
                  id="employee-job-title"
                  placeholder="Mis. Operator Sewing"
                  aria-invalid={Boolean(errors.jobTitle) || undefined}
                  {...form.register("jobTitle")}
                />
                {errors.jobTitle ? <FieldError>{errors.jobTitle.message}</FieldError> : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.phone) || undefined}>
                <FieldLabel htmlFor="employee-phone">Telepon</FieldLabel>
                <Input
                  id="employee-phone"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  {...form.register("phone")}
                />
                {errors.phone ? <FieldError>{errors.phone.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.email) || undefined}>
                <FieldLabel htmlFor="employee-email">Email</FieldLabel>
                <Input
                  id="employee-email"
                  type="email"
                  aria-invalid={Boolean(errors.email) || undefined}
                  {...form.register("email")}
                />
                {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
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

/** Tombol + dialog untuk menambah karyawan baru dari toolbar halaman. */
export function CreateEmployeeButton({ departments }: { departments: DepartmentOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Tambah Karyawan
      </Button>
      {open ? (
        <EmployeeFormDialog open departments={departments} onOpenChange={(next) => setOpen(next)} />
      ) : null}
    </>
  );
}
