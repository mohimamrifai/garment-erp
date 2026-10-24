import { CalendarDays } from "lucide-react";
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
import type { LeaveRequestListRow } from "../service";
import { LeaveActions } from "./leave-actions";
import { LeaveStatusBadge } from "./leave-status-badge";

export function LeaveTable({
  requests,
  canApprove,
  canCancel,
}: {
  requests: LeaveRequestListRow[];
  canApprove: boolean;
  canCancel: boolean;
}) {
  if (requests.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>Belum ada pengajuan cuti</EmptyTitle>
          <EmptyDescription>
            Pengajuan cuti karyawan akan tampil di sini untuk disetujui atau ditolak.
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
            <TableHead>Nomor</TableHead>
            <TableHead>Karyawan</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead className="text-right">Hari</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Alasan</TableHead>
            {canApprove || canCancel ? <TableHead className="text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-mono text-[12px]">{request.number}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{request.employeeName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {request.employeeCode} · {request.departmentName}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-[13px]">
                {request.leaveTypeName}
                {request.isPaid ? null : (
                  <span className="ml-1 text-[11px] text-muted-foreground">(tidak dibayar)</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-[12px] tabular-nums">
                {formatDateId(request.startDate)} – {formatDateId(request.endDate)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {request.days}
              </TableCell>
              <TableCell>
                <LeaveStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="max-w-64 truncate text-[12px] text-muted-foreground">
                {request.status === "REJECTED" && request.rejectionReason
                  ? request.rejectionReason
                  : request.reason}
              </TableCell>
              {canApprove || canCancel ? (
                <TableCell>
                  <LeaveActions
                    request={request}
                    canApprove={canApprove}
                    canCancel={canCancel}
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
