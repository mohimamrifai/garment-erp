"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_STATUSES, LEAVE_STATUS_LABELS } from "../schemas";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

export function LeaveFilters({
  employeeId,
  status,
  employees,
}: {
  employeeId: string;
  status: string;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(update: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(update)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={employeeId || "all"}
        onValueChange={(next) => apply({ employeeId: next === "all" ? null : next })}
        items={[
          { value: "all", label: "Semua karyawan" },
          ...employees.map((employee) => ({
            value: employee.id,
            label: `${employee.code} — ${employee.name}`,
          })),
        ]}
      >
        <SelectTrigger className="w-56" aria-label="Filter karyawan cuti">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Semua karyawan</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.code} — {employee.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={status}
        onValueChange={(next) => apply({ status: next === "all" ? null : next })}
        items={[
          { value: "all", label: "Semua status" },
          ...LEAVE_STATUSES.map((value) => ({ value, label: LEAVE_STATUS_LABELS[value] })),
        ]}
      >
        <SelectTrigger className="w-40" aria-label="Filter status cuti">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Semua status</SelectItem>
            {LEAVE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {LEAVE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
