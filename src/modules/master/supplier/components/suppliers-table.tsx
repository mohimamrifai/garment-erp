"use client";

import { Package } from "lucide-react";
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
import type { Supplier } from "../service";
import { SupplierFormDialog } from "./supplier-form-dialog";

export function SuppliersTable({
  suppliers,
  canWrite,
}: {
  suppliers: Supplier[];
  canWrite: boolean;
}) {
  if (suppliers.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Package />
          </EmptyMedia>
          <EmptyTitle>Belum ada supplier</EmptyTitle>
          <EmptyDescription>
            Tambahkan supplier pertama atau ubah filter pencarian Anda.
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
            <TableHead>Supplier</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{supplier.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{supplier.name}</span>
                  {supplier.address ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {supplier.address}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{supplier.contactPerson ?? "-"}</span>
                  <span className="nums font-mono text-[11px] text-muted-foreground">
                    {[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "-"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={supplier.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/suppliers/${supplier.id}`}
                    isActive={supplier.isActive}
                    entityName="Supplier"
                    itemName={supplier.name}
                    deactivateHint="tidak muncul di pilihan purchase order baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <SupplierFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        supplier={supplier}
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
