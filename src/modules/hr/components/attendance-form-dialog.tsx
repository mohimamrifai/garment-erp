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
import type { AttendanceListRow } from "../service";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  attendanceFormSchema,
  type AttendanceFormInput,
} from "../schemas";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

type AttendanceFormDialogProps = {
  employees: EmployeeOption[];
  record?: AttendanceListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AttendanceFormDialog({
  employees,
  record,
  open,
  onOpenChange,
}: AttendanceFormDialogProps) {
  const router = useRouter();
  const form = useForm<AttendanceFormInput>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      employeeId: record?.employeeId ?? employees[0]?.id ?? "",
      attendanceDate: record?.attendanceDate ?? getTodayDate(),
      status: (record?.status as AttendanceFormInput["status"]) ?? "PRESENT",
      checkIn: record?.checkIn ?? "08:00",
      checkOut: record?.checkOut ?? "17:00",
      overtimeHours: record ? Number(record.overtimeHours) : 0,
      notes: record?.notes ?? "",
    },
  });
  const {
    formState: { errors, isSubmitting },
    reset,
  } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      employeeId: record?.employeeId ?? employees[0]?.id ?? "",
      attendanceDate: record?.attendanceDate ?? getTodayDate(),
      status: (record?.status as AttendanceFormInput["status"]) ?? "PRESENT",
      checkIn: record?.checkIn ?? "08:00",
      checkOut: record?.checkOut ?? "17:00",
      overtimeHours: record ? Number(record.overtimeHours) : 0,
      notes: record?.notes ?? "",
    });
  }, [open, record, employees, reset]);

  async function submit(values: AttendanceFormInput) {
    try {
      if (record) {
        await requestJson(`/api/v1/hr/attendance/${record.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Absensi berhasil diperbarui.");
      } else {
        await requestJson("/api/v1/hr/attendance", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Absensi berhasil dicatat.");
      }
      onOpenChange(false);
      router.refresh();
    } catch (caught) {
      form.setError("root", {
        message: caught instanceof ApiRequestError ? caught.message : "Gagal menyimpan absensi.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? "Ubah Absensi" : "Catat Absensi"}</DialogTitle>
          <DialogDescription>
            Absensi dipakai untuk menghitung potongan cuti tidak dibayar dan upah lembur pada
            payroll bulanan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" data-invalid={Boolean(errors.employeeId) || undefined}>
              <FieldLabel htmlFor="attendance-employee">Karyawan</FieldLabel>
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
                    <SelectTrigger id="attendance-employee" className="w-full">
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

            <Field data-invalid={Boolean(errors.attendanceDate) || undefined}>
              <FieldLabel htmlFor="attendance-date">Tanggal</FieldLabel>
              <Input id="attendance-date" type="date" {...form.register("attendanceDate")} />
              {errors.attendanceDate ? (
                <FieldError>{errors.attendanceDate.message}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={Boolean(errors.status) || undefined}>
              <FieldLabel htmlFor="attendance-status">Status</FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(next) => field.onChange(next ?? "PRESENT")}
                    items={ATTENDANCE_STATUSES.map((status) => ({
                      value: status,
                      label: ATTENDANCE_STATUS_LABELS[status],
                    }))}
                  >
                    <SelectTrigger id="attendance-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ATTENDANCE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status ? <FieldError>{errors.status.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.checkIn) || undefined}>
              <FieldLabel htmlFor="attendance-checkin">Jam masuk</FieldLabel>
              <Input id="attendance-checkin" type="time" {...form.register("checkIn")} />
              {errors.checkIn ? <FieldError>{errors.checkIn.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.checkOut) || undefined}>
              <FieldLabel htmlFor="attendance-checkout">Jam keluar</FieldLabel>
              <Input id="attendance-checkout" type="time" {...form.register("checkOut")} />
              {errors.checkOut ? <FieldError>{errors.checkOut.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.overtimeHours) || undefined}>
              <FieldLabel htmlFor="attendance-overtime">Jam lembur</FieldLabel>
              <Input
                id="attendance-overtime"
                type="number"
                min={0}
                max={24}
                step="0.25"
                {...form.register("overtimeHours", { valueAsNumber: true })}
              />
              {errors.overtimeHours ? (
                <FieldError>{errors.overtimeHours.message}</FieldError>
              ) : null}
            </Field>

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="attendance-notes">Catatan</FieldLabel>
              <Textarea
                id="attendance-notes"
                rows={3}
                placeholder="Opsional, mis. keterangan keterlambatan."
                {...form.register("notes")}
              />
              {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
            </Field>
          </div>

          {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {record ? "Simpan Perubahan" : "Catat Absensi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
