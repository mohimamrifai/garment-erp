"use client";

import { Building2 } from "lucide-react";
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
import type { Department } from "../service";
import { DepartmentFormDialog } from "./department-form-dialog";

export function DepartmentsTable({
  departments,
  canWrite,
}: {
  departments: Department[];
  canWrite: boolean;
}) {
  if (departments.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>Belum ada departemen</EmptyTitle>
          <EmptyDescription>
            Tambahkan departemen pertama atau ubah filter pencarian Anda.
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
            <TableHead>Departemen</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((department) => (
            <TableRow key={department.id}>
              <TableCell className="font-mono text-xs text-foreground/70">
                {department.code}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{department.name}</span>
                  {department.description ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {department.description}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={department.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/departments/${department.id}`}
                    isActive={department.isActive}
                    entityName="Departemen"
                    itemName={department.name}
                    renderEditDialog={({ open, onOpenChange }) => (
                      <DepartmentFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        department={department}
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
