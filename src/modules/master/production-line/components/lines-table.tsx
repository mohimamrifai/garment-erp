"use client";

import { Factory } from "lucide-react";
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
import type { ProductionLine } from "../service";
import { LineFormDialog } from "./line-form-dialog";

export function LinesTable({
  lines,
  canWrite,
}: {
  lines: ProductionLine[];
  canWrite: boolean;
}) {
  if (lines.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Factory />
          </EmptyMedia>
          <EmptyTitle>Belum ada lini produksi</EmptyTitle>
          <EmptyDescription>
            Tambahkan lini pertama atau ubah filter pencarian Anda.
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
            <TableHead>Lini Produksi</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{line.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{line.name}</span>
                  {line.notes ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">{line.notes}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={line.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/lines/${line.id}`}
                    isActive={line.isActive}
                    entityName="Lini produksi"
                    itemName={line.name}
                    renderEditDialog={({ open, onOpenChange }) => (
                      <LineFormDialog open={open} onOpenChange={onOpenChange} line={line} />
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
