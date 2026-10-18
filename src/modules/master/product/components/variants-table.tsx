"use client";

import Link from "next/link";
import { Ruler } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ActiveStatusBadge } from "@/components/master-data/status-badge";
import { MasterRowActions } from "@/components/master-data/row-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductVariant } from "../service";
import { VariantFormDialog } from "./variant-form-dialog";

export function VariantsTable({
  variants,
  canWrite,
  productId,
  productSku,
}: {
  variants: ProductVariant[];
  canWrite: boolean;
  productId: string;
  productSku: string;
}) {
  if (variants.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Ruler />
          </EmptyMedia>
          <EmptyTitle>Belum ada varian</EmptyTitle>
          <EmptyDescription>
            Tambahkan varian ukuran/warna agar produk bisa dipesan pada sales order.
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
            <TableHead>SKU Varian</TableHead>
            <TableHead className="w-24">Ukuran</TableHead>
            <TableHead className="w-32">Warna</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28 text-right">BOM</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => (
            <TableRow key={variant.id}>
              <TableCell className="font-mono text-xs text-foreground/70">
                {variant.variantSku}
              </TableCell>
              <TableCell className="font-mono text-sm">{variant.size}</TableCell>
              <TableCell className="text-sm">{variant.color}</TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={variant.isActive} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/master/bom?variant=${variant.id}`} />}
                >
                  Kelola BOM
                </Button>
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/variants/${variant.id}`}
                    isActive={variant.isActive}
                    entityName="Varian"
                    itemName={variant.variantSku}
                    deactivateHint="tidak muncul di pilihan sales order baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <VariantFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        productId={productId}
                        productSku={productSku}
                        variant={variant}
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
