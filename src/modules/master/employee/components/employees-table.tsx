"use client";

import { UserRound } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ActiveStatusBadge } from "@/components/master-data/status-badge";
import { MasterRowActions } from "@/components/master-data/row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeListRow } from "../service";
import { EmployeeFormDialog, type DepartmentOption } from "./employee-form-dialog";

export function EmployeesTable({
  employees,
  canWrite,
  departments,
}: {
  employees: EmployeeListRow[];
  canWrite: boolean;
  departments: DepartmentOption[];
}) {
  if (employees.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <UserRound />
          </EmptyMedia>
          <EmptyTitle>Belum ada karyawan</EmptyTitle>
          <EmptyDescription>
            Tambahkan karyawan pertama atau ubah filter pencarian Anda.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Kode</TableHead>
            <TableHead>Karyawan</TableHead>
            <TableHead>Jabatan</TableHead>
            <TableHead>Departemen</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{employee.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{employee.name}</span>
                  {employee.phone || employee.email ? (
                    <span className="nums font-mono text-[11px] text-muted-foreground">
                      {[employee.phone, employee.email].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm">{employee.jobTitle}</TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{employee.departmentName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {employee.departmentCode}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={employee.employmentStatus === "ACTIVE"} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/employees/${employee.id}`}
                    isActive={employee.employmentStatus === "ACTIVE"}
                    entityName="Karyawan"
                    itemName={employee.name}
                    buildToggleBody={(next) => ({
                      employmentStatus: next ? "ACTIVE" : "INACTIVE",
                    })}
                    deactivateHint="riwayat produksinya tetap tersimpan."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <EmployeeFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        employee={employee}
                        departments={departments}
                      />
                    )}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
