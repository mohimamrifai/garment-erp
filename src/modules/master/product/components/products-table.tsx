"use client";

import Link from "next/link";
import { Shirt } from "lucide-react";
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
import type { ProductListRow } from "../service";
import { ProductFormDialog } from "./product-form-dialog";

export function ProductsTable({
  products,
  canWrite,
}: {
  products: ProductListRow[];
  canWrite: boolean;
}) {
  if (products.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Shirt />
          </EmptyMedia>
          <EmptyTitle>Belum ada produk</EmptyTitle>
          <EmptyDescription>
            Tambahkan produk pertama atau ubah filter pencarian Anda.
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
            <TableHead className="w-28">SKU</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead className="w-24 text-right">Varian</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-mono text-xs text-foreground/70">{product.sku}</TableCell>
              <TableCell>
                <Link
                  href={`/master/products/${product.id}`}
                  className="flex flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="font-medium underline-offset-4 hover:underline">
                    {product.name}
                  </span>
                  {product.description ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {product.description}
                    </span>
                  ) : null}
                </Link>
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatNumber(product.variantCount)}
              </TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={product.isActive} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <MasterRowActions
                    endpoint={`/api/v1/master/products/${product.id}`}
                    isActive={product.isActive}
                    entityName="Produk"
                    itemName={product.name}
                    deactivateHint="tidak muncul di pilihan sales order baru."
                    renderEditDialog={({ open, onOpenChange }) => (
                      <ProductFormDialog
                        open={open}
                        onOpenChange={onOpenChange}
                        product={product}
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
