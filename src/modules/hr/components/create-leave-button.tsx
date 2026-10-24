"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeaveType } from "@/lib/db/schema";
import { LeaveFormDialog } from "./leave-form-dialog";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

export function CreateLeaveButton({
  employees,
  leaveTypes,
}: {
  employees: EmployeeOption[];
  leaveTypes: LeaveType[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={employees.length === 0}>
        <Plus data-icon="inline-start" />
        Ajukan Cuti
      </Button>
      <LeaveFormDialog
        employees={employees}
        leaveTypes={leaveTypes}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
