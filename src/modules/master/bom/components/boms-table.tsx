"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils/currency";
import { formatDateId } from "@/lib/utils/dates";
import type { BomListRow } from "../service";
import { BomRowActions } from "./bom-row-actions";
import { BomStatusBadge } from "./bom-status-badge";

export function BomsTable({ boms, canWrite }: { boms: BomListRow[]; canWrite: boolean }) {
  if (boms.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>Belum ada BOM</EmptyTitle>
          <EmptyDescription>
            Buat BOM untuk sebuah varian, tambahkan material, lalu aktifkan.
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
            <TableHead>Varian</TableHead>
            <TableHead className="w-20">Versi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20 text-right">Item</TableHead>
            <TableHead className="w-56">Efektif</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {boms.map((bom) => (
            <TableRow key={bom.id}>
              <TableCell>
                <Link
                  href={`/master/bom/${bom.id}`}
                  className="flex flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="font-medium underline-offset-4 hover:underline">
                    {bom.productName}
                  </span>
                  <span className="nums font-mono text-[11px] text-muted-foreground">
                    {bom.variantSku} · {bom.size}/{bom.color}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="nums font-mono text-sm">v{bom.version}</TableCell>
              <TableCell>
                <BomStatusBadge isActive={bom.isActive} />
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatNumber(bom.itemCount)}
              </TableCell>
              <TableCell className="nums font-mono text-xs text-muted-foreground">
                {formatDateId(bom.effectiveFrom)}
                {bom.effectiveUntil
                  ? ` → ${formatDateId(bom.effectiveUntil)}`
                  : bom.isActive
                    ? " →"
                    : ""}
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <BomRowActions bom={bom} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
