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
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  TAX_STATUSES,
  employeeFormSchema,
  type EmployeeFormInput,
} from "../schemas";

export type DepartmentOption = { id: string; code: string; name: string };

type EmployeeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  departments: DepartmentOption[];
};

const EMPLOYMENT_TYPE_ITEMS = EMPLOYMENT_TYPES.map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}));

const TAX_STATUS_ITEMS = TAX_STATUSES.map((value) => ({ value, label: value }));

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
      joinDate: employee?.joinDate ?? "",
      employmentType: employee?.employmentType ?? "PERMANENT",
      contractStartDate: employee?.contractStartDate ?? "",
      contractEndDate: employee?.contractEndDate ?? "",
      resignDate: employee?.resignDate ?? "",
      birthDate: employee?.birthDate ?? "",
      address: employee?.address ?? "",
      basicSalary: Number(employee?.basicSalary ?? 0),
      fixedAllowance: Number(employee?.fixedAllowance ?? 0),
      bankName: employee?.bankName ?? "",
      bankAccountNumber: employee?.bankAccountNumber ?? "",
      bankAccountName: employee?.bankAccountName ?? "",
      npwp: employee?.npwp ?? "",
      bpjsKesehatanNumber: employee?.bpjsKesehatanNumber ?? "",
      bpjsKetenagakerjaanNumber: employee?.bpjsKetenagakerjaanNumber ?? "",
      taxStatus: (employee?.taxStatus as EmployeeFormInput["taxStatus"]) ?? "TK/0",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ubah Karyawan ${employee?.code}` : "Tambah Karyawan"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi kepegawaian dan data payroll karyawan."
              : "Kode karyawan dibuat otomatis (format EMP-0001)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              Identitas & penempatan
            </p>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.birthDate) || undefined}>
                <FieldLabel htmlFor="employee-birth-date">Tanggal lahir</FieldLabel>
                <Input
                  id="employee-birth-date"
                  type="date"
                  aria-invalid={Boolean(errors.birthDate) || undefined}
                  {...form.register("birthDate")}
                />
                {errors.birthDate ? <FieldError>{errors.birthDate.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.joinDate) || undefined}>
                <FieldLabel htmlFor="employee-join-date">Tanggal masuk</FieldLabel>
                <Input
                  id="employee-join-date"
                  type="date"
                  aria-invalid={Boolean(errors.joinDate) || undefined}
                  {...form.register("joinDate")}
                />
                {errors.joinDate ? <FieldError>{errors.joinDate.message}</FieldError> : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.address) || undefined}>
              <FieldLabel htmlFor="employee-address">Alamat</FieldLabel>
              <Input
                id="employee-address"
                placeholder="Alamat domisili"
                aria-invalid={Boolean(errors.address) || undefined}
                {...form.register("address")}
              />
              {errors.address ? <FieldError>{errors.address.message}</FieldError> : null}
            </Field>

            <p className="mt-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              Kontrak & payroll
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.employmentType) || undefined}>
                <FieldLabel htmlFor="employee-employment-type">Jenis kepegawaian</FieldLabel>
                <Controller
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(next) => field.onChange(next)}
                      items={EMPLOYMENT_TYPE_ITEMS}
                    >
                      <SelectTrigger id="employee-employment-type" className="w-full">
                        <SelectValue placeholder="Pilih jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {EMPLOYMENT_TYPE_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.employmentType ? (
                  <FieldError>{errors.employmentType.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.taxStatus) || undefined}>
                <FieldLabel htmlFor="employee-tax-status">Status PTKP</FieldLabel>
                <Controller
                  control={form.control}
                  name="taxStatus"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(next) => field.onChange(next)}
                      items={TAX_STATUS_ITEMS}
                    >
                      <SelectTrigger id="employee-tax-status" className="w-full">
                        <SelectValue placeholder="Pilih PTKP" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TAX_STATUS_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.taxStatus ? <FieldError>{errors.taxStatus.message}</FieldError> : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.contractStartDate) || undefined}>
                <FieldLabel htmlFor="employee-contract-start">Awal kontrak</FieldLabel>
                <Input
                  id="employee-contract-start"
                  type="date"
                  aria-invalid={Boolean(errors.contractStartDate) || undefined}
                  {...form.register("contractStartDate")}
                />
                {errors.contractStartDate ? (
                  <FieldError>{errors.contractStartDate.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.contractEndDate) || undefined}>
                <FieldLabel htmlFor="employee-contract-end">Akhir kontrak</FieldLabel>
                <Input
                  id="employee-contract-end"
                  type="date"
                  aria-invalid={Boolean(errors.contractEndDate) || undefined}
                  {...form.register("contractEndDate")}
                />
                {errors.contractEndDate ? (
                  <FieldError>{errors.contractEndDate.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.basicSalary) || undefined}>
                <FieldLabel htmlFor="employee-basic-salary">Gaji pokok (Rp)</FieldLabel>
                <Input
                  id="employee-basic-salary"
                  type="number"
                  min={0}
                  step={1000}
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.basicSalary) || undefined}
                  {...form.register("basicSalary", { valueAsNumber: true })}
                />
                {errors.basicSalary ? <FieldError>{errors.basicSalary.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.fixedAllowance) || undefined}>
                <FieldLabel htmlFor="employee-fixed-allowance">Tunjangan tetap (Rp)</FieldLabel>
                <Input
                  id="employee-fixed-allowance"
                  type="number"
                  min={0}
                  step={1000}
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.fixedAllowance) || undefined}
                  {...form.register("fixedAllowance", { valueAsNumber: true })}
                />
                {errors.fixedAllowance ? (
                  <FieldError>{errors.fixedAllowance.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.bankName) || undefined}>
                <FieldLabel htmlFor="employee-bank-name">Bank</FieldLabel>
                <Input
                  id="employee-bank-name"
                  placeholder="Mis. BCA"
                  aria-invalid={Boolean(errors.bankName) || undefined}
                  {...form.register("bankName")}
                />
                {errors.bankName ? <FieldError>{errors.bankName.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.bankAccountNumber) || undefined}>
                <FieldLabel htmlFor="employee-bank-account">Nomor rekening</FieldLabel>
                <Input
                  id="employee-bank-account"
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.bankAccountNumber) || undefined}
                  {...form.register("bankAccountNumber")}
                />
                {errors.bankAccountNumber ? (
                  <FieldError>{errors.bankAccountNumber.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.bankAccountName) || undefined}>
              <FieldLabel htmlFor="employee-bank-account-name">Nama pemilik rekening</FieldLabel>
              <Input
                id="employee-bank-account-name"
                aria-invalid={Boolean(errors.bankAccountName) || undefined}
                {...form.register("bankAccountName")}
              />
              {errors.bankAccountName ? (
                <FieldError>{errors.bankAccountName.message}</FieldError>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={Boolean(errors.npwp) || undefined}>
                <FieldLabel htmlFor="employee-npwp">NPWP</FieldLabel>
                <Input
                  id="employee-npwp"
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.npwp) || undefined}
                  {...form.register("npwp")}
                />
                {errors.npwp ? <FieldError>{errors.npwp.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.bpjsKesehatanNumber) || undefined}>
                <FieldLabel htmlFor="employee-bpjs-kes">BPJS Kesehatan</FieldLabel>
                <Input
                  id="employee-bpjs-kes"
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.bpjsKesehatanNumber) || undefined}
                  {...form.register("bpjsKesehatanNumber")}
                />
                {errors.bpjsKesehatanNumber ? (
                  <FieldError>{errors.bpjsKesehatanNumber.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.bpjsKetenagakerjaanNumber) || undefined}>
                <FieldLabel htmlFor="employee-bpjs-tk">BPJS Ketenagakerjaan</FieldLabel>
                <Input
                  id="employee-bpjs-tk"
                  className="font-mono tabular-nums"
                  aria-invalid={Boolean(errors.bpjsKetenagakerjaanNumber) || undefined}
                  {...form.register("bpjsKetenagakerjaanNumber")}
                />
                {errors.bpjsKetenagakerjaanNumber ? (
                  <FieldError>{errors.bpjsKetenagakerjaanNumber.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.resignDate) || undefined}>
              <FieldLabel htmlFor="employee-resign-date">Tanggal keluar (opsional)</FieldLabel>
              <Input
                id="employee-resign-date"
                type="date"
                aria-invalid={Boolean(errors.resignDate) || undefined}
                {...form.register("resignDate")}
              />
              {errors.resignDate ? <FieldError>{errors.resignDate.message}</FieldError> : null}
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
