"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttendanceFormDialog } from "./attendance-form-dialog";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

export function CreateAttendanceButton({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={employees.length === 0}>
        <Plus data-icon="inline-start" />
        Catat Absensi
      </Button>
      <AttendanceFormDialog employees={employees} open={open} onOpenChange={setOpen} />
    </>
  );
}
