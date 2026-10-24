import { CalendarCheck } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId } from "@/lib/utils/dates";
import type { AttendanceListRow } from "../service";
import { AttendanceRowActions } from "./attendance-row-actions";
import { AttendanceStatusBadge } from "./attendance-status-badge";

type EmployeeOption = { id: string; code: string; name: string; departmentName: string };

export function AttendanceTable({
  records,
  employees,
  canManage,
}: {
  records: AttendanceListRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  if (records.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada absensi</EmptyTitle>
          <EmptyDescription>
            Catat absensi manual atau impor dari mesin fingerprint sesuai kebutuhan payroll.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Tanggal</TableHead>
            <TableHead>Karyawan</TableHead>
            <TableHead>Departemen</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Masuk</TableHead>
            <TableHead>Keluar</TableHead>
            <TableHead className="text-right">Lembur</TableHead>
            <TableHead>Catatan</TableHead>
            {canManage ? <TableHead className="text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {formatDateId(record.attendanceDate)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{record.employeeName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {record.employeeCode}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-[13px]">{record.departmentName}</TableCell>
              <TableCell>
                <AttendanceStatusBadge status={record.status} />
              </TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {record.checkIn ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {record.checkOut ?? "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {Number(record.overtimeHours).toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell className="max-w-56 truncate text-[12px] text-muted-foreground">
                {record.notes ?? "—"}
              </TableCell>
              {canManage ? (
                <TableCell>
                  <AttendanceRowActions record={record} employees={employees} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
