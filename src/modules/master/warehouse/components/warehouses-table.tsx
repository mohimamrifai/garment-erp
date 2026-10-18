"use client";

import Link from "next/link";
import { Warehouse as WarehouseIcon } from "lucide-react";
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
import type { WarehouseListRow } from "../service";
import { WarehouseFormDialog } from "./warehouse-form-dialog";

export function WarehousesTable({
  warehouses,
  canWrite,
}: {
  warehouses: WarehouseListRow[];
  canWrite: boolean;
}) {
  if (warehouses.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <WarehouseIcon />
          </EmptyMedia>
          <EmptyTitle>Belum ada gudang</EmptyTitle>
          <EmptyDescription>
            Tambahkan gudang pertama atau ubah filter pencarian Anda.
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
            <TableHead>Gudang</TableHead>
            <TableHead className="w-24 text-right">Lokasi</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouses.map((warehouse) => (
            <TableRow key={warehouse.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{warehouse.code}</TableCell>
              <TableCell>
                <Link
                  href={`/master/warehouses/${warehouse.id}`}
                  className="flex flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="font-medium underline-offset-4 hover:underline">
                    {warehouse.name}
                  </span>
                  {warehouse.address ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {warehouse.address}
                    </span>
                  ) : null}
                </Link>
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatNumber(warehouse.locationCount)}
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={warehouse.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/warehouses/${warehouse.id}`}
                    isActive={warehouse.isActive}
                    entityName="Gudang"
                    itemName={warehouse.name}
                    deactivateHint="tidak muncul di pilihan lokasi stok baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <WarehouseFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        warehouse={warehouse}
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
