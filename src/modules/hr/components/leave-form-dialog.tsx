"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { getTodayDate } from "@/lib/utils/dates";
import type { LeaveType } from "@/lib/db/schema";
import { leaveRequestFormSchema, type LeaveRequestFormInput } from "../schemas";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

export function LeaveFormDialog({
  employees,
  leaveTypes,
  open,
  onOpenChange,
}: {
  employees: EmployeeOption[];
  leaveTypes: LeaveType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<LeaveRequestFormInput>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: {
      employeeId: employees[0]?.id ?? "",
      leaveTypeId: leaveTypes[0]?.id ?? "",
      startDate: getTodayDate(),
      endDate: getTodayDate(),
      reason: "",
    },
  });
  const {
    formState: { errors, isSubmitting },
    reset,
  } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      employeeId: employees[0]?.id ?? "",
      leaveTypeId: leaveTypes[0]?.id ?? "",
      startDate: getTodayDate(),
      endDate: getTodayDate(),
      reason: "",
    });
  }, [open, employees, leaveTypes, reset]);

  async function submit(values: LeaveRequestFormInput) {
    try {
      await requestJson("/api/v1/hr/leave-requests", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Pengajuan cuti berhasil dibuat.");
      onOpenChange(false);
      router.refresh();
    } catch (caught) {
      form.setError("root", {
        message: caught instanceof ApiRequestError ? caught.message : "Gagal membuat pengajuan cuti.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajukan Cuti</DialogTitle>
          <DialogDescription>
            Cuti yang disetujui akan diperhitungkan pada payroll. Cuti tidak dibayar mengurangi gaji
            neto karyawan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" data-invalid={Boolean(errors.employeeId) || undefined}>
              <FieldLabel htmlFor="leave-employee">Karyawan</FieldLabel>
              <Controller
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next ?? "")}
                    items={employees.map((employee) => ({
                      value: employee.id,
                      label: `${employee.code} — ${employee.name}`,
                    }))}
                  >
                    <SelectTrigger id="leave-employee" className="w-full">
                      <SelectValue placeholder="Pilih karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.code} — {employee.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employeeId ? <FieldError>{errors.employeeId.message}</FieldError> : null}
            </Field>

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.leaveTypeId) || undefined}>
              <FieldLabel htmlFor="leave-type">Jenis cuti</FieldLabel>
              <Controller
                control={form.control}
                name="leaveTypeId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next ?? "")}
                    items={leaveTypes.map((type) => ({
                      value: type.id,
                      label: `${type.name}${type.isPaid ? "" : " (tidak dibayar)"}`,
                    }))}
                  >
                    <SelectTrigger id="leave-type" className="w-full">
                      <SelectValue placeholder="Pilih jenis cuti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {leaveTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                            {type.isPaid ? "" : " (tidak dibayar)"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.leaveTypeId ? <FieldError>{errors.leaveTypeId.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.startDate) || undefined}>
              <FieldLabel htmlFor="leave-start">Tanggal mulai</FieldLabel>
              <Input id="leave-start" type="date" {...form.register("startDate")} />
              {errors.startDate ? <FieldError>{errors.startDate.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.endDate) || undefined}>
              <FieldLabel htmlFor="leave-end">Tanggal selesai</FieldLabel>
              <Input id="leave-end" type="date" {...form.register("endDate")} />
              {errors.endDate ? <FieldError>{errors.endDate.message}</FieldError> : null}
            </Field>

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.reason) || undefined}>
              <FieldLabel htmlFor="leave-reason">Alasan</FieldLabel>
              <Textarea
                id="leave-reason"
                rows={3}
                placeholder="Jelaskan alasan cuti."
                {...form.register("reason")}
              />
              {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
            </Field>
          </div>

          {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || leaveTypes.length === 0}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Ajukan Cuti
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
