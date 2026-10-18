"use client";

import { Ruler } from "lucide-react";
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
import type { Uom } from "../service";
import { UomFormDialog } from "./uom-form-dialog";

export function UomsTable({ uoms, canWrite }: { uoms: Uom[]; canWrite: boolean }) {
  if (uoms.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Ruler />
          </EmptyMedia>
          <EmptyTitle>Belum ada satuan</EmptyTitle>
          <EmptyDescription>
            Tambahkan satuan pertama atau ubah filter pencarian Anda.
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
            <TableHead>Nama Satuan</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {uoms.map((uom) => (
            <TableRow key={uom.id}>
              <TableCell className="font-mono text-xs font-medium text-foreground/80">
                {uom.code}
              </TableCell>
              <TableCell className="font-medium">{uom.name}</TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={uom.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/uoms/${uom.id}`}
                    isActive={uom.isActive}
                    entityName="Satuan"
                    itemName={`${uom.code} — ${uom.name}`}
                    deactivateHint="tidak muncul di pilihan satuan material baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <UomFormDialog open={open} onOpenChange={onOpenChange} uom={uom} />
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
