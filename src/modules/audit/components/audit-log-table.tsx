import { ScrollText } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeId } from "@/lib/utils/dates";
import { formatAuditAction, formatAuditDetails, formatAuditEntity } from "../format";
import type { AuditLogRow } from "../service";

/** Tabel audit log hanya-baca (PRD M11). */
export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollText />
          </EmptyMedia>
          <EmptyTitle>Belum ada catatan audit</EmptyTitle>
          <EmptyDescription>
            Catatan akan muncul setelah ada tindakan yang mengubah data atau status dokumen.
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
            <TableHead>Waktu</TableHead>
            <TableHead>Aktor</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Entitas</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const detail = formatAuditDetails(row.details);
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {formatDateTimeId(row.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{row.actorName ?? "Sistem"}</span>
                    {row.actorEmail ? (
                      <span className="text-xs text-muted-foreground">{row.actorEmail}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  <span title={row.action}>{formatAuditAction(row.action)}</span>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-col">
                    <span>{formatAuditEntity(row.entityType)}</span>
                    {row.entityId ? (
                      <span
                        className="font-mono text-[11px] text-muted-foreground"
                        title={row.entityId}
                      >
                        #{row.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell
                  className="w-[320px] max-w-[320px] align-top font-mono text-[11px] whitespace-normal text-muted-foreground"
                  title={detail === "—" ? undefined : detail}
                >
                  <div className="line-clamp-2 break-words">{detail}</div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
