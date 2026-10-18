"use client";

import { Layers } from "lucide-react";
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
import { formatNumber } from "@/lib/utils/currency";
import type { MaterialListRow } from "../service";
import { MaterialFormDialog, type UomOption } from "./material-form-dialog";

export function MaterialsTable({
  materials,
  canWrite,
  uoms,
}: {
  materials: MaterialListRow[];
  canWrite: boolean;
  uoms: UomOption[];
}) {
  if (materials.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Layers />
          </EmptyMedia>
          <EmptyTitle>Belum ada material</EmptyTitle>
          <EmptyDescription>
            Tambahkan material pertama atau ubah filter pencarian Anda.
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
            <TableHead>Material</TableHead>
            <TableHead className="w-24">Satuan</TableHead>
            <TableHead className="w-32 text-right">Stok Min.</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => (
            <TableRow key={material.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{material.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{material.name}</span>
                  {material.notes ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {material.notes}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-foreground/70">
                {material.unitCode}
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatNumber(material.minimumStock)}
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={material.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/materials/${material.id}`}
                    isActive={material.isActive}
                    entityName="Material"
                    itemName={material.name}
                    deactivateHint="tidak muncul di BOM baru dan purchase order baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <MaterialFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        material={material}
                        uoms={uoms}
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
