"use client";

import { MapPin } from "lucide-react";
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
import type { WarehouseLocation } from "../service";
import { LocationFormDialog } from "./location-form-dialog";

export function LocationsTable({
  locations,
  canWrite,
  warehouseId,
  warehouseCode,
}: {
  locations: WarehouseLocation[];
  canWrite: boolean;
  warehouseId: string;
  warehouseCode: string;
}) {
  if (locations.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <MapPin />
          </EmptyMedia>
          <EmptyTitle>Belum ada lokasi</EmptyTitle>
          <EmptyDescription>
            Tambahkan lokasi/rak di gudang ini agar stok bisa ditempatkan.
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
            <TableHead className="w-32">Kode</TableHead>
            <TableHead>Nama Lokasi</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <TableRow key={location.id}>
              <TableCell className="font-mono text-xs font-medium text-foreground/80">
                {location.code}
              </TableCell>
              <TableCell className="font-medium">{location.name}</TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={location.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/locations/${location.id}`}
                    isActive={location.isActive}
                    entityName="Lokasi"
                    itemName={`${location.code} — ${location.name}`}
                    deactivateHint="tidak muncul di pilihan lokasi stok baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <LocationFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        warehouseId={warehouseId}
                        warehouseCode={warehouseCode}
                        location={location}
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
