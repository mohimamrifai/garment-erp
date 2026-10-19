import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeId } from "@/lib/utils/dates";
import type { AuditLogRow } from "../service";

function detailsText(details: Record<string, unknown> | null): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const text = JSON.stringify(details);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** Tabel audit log read-only (PRD M11). */
export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Belum ada catatan audit yang cocok.
      </div>
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
            const detail = detailsText(row.details);
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
                <TableCell className="font-mono text-xs">{row.action}</TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="flex flex-col">
                    <span>{row.entityType}</span>
                    {row.entityId ? (
                      <span className="text-muted-foreground">{row.entityId.slice(0, 8)}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell
                  className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground"
                  title={detail}
                >
                  {detail}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
