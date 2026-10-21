import { PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils/currency";
import type { FinishedGoodsStockRow } from "../service";

type FinishedGoodsTableProps = {
  rows: FinishedGoodsStockRow[];
};

const FINISHED_GOOD_UNIT = "PCS";

function StockQuantity({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-baseline justify-end gap-1">
      {formatNumber(value)}
      <span className="text-[10px] font-normal tracking-wide text-muted-foreground">
        {FINISHED_GOOD_UNIT}
      </span>
    </span>
  );
}

/** Tabel saldo barang jadi per varian dan lokasi. */
export function FinishedGoodsTable({ rows }: FinishedGoodsTableProps) {
  if (rows.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>Belum ada stok barang jadi</EmptyTitle>
          <EmptyDescription>
            Barang jadi otomatis masuk setelah inspeksi QC akhir (tahap packing) berstatus lolos.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Produk</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead className="text-right">Stok Fisik</TableHead>
            <TableHead className="text-right">Direservasi</TableHead>
            <TableHead className="text-right">Tersedia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const available = Number(row.quantityAvailable);
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{row.productName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {row.variantSku} · {row.size}/{row.color}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{row.locationName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {row.warehouseName} / {row.locationCode}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  <StockQuantity value={row.quantityOnHand} />
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {Number(row.quantityReserved) > 0 ? (
                    <StockQuantity value={row.quantityReserved} />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {available > 0 ? (
                    <span className="font-mono font-medium tabular-nums">
                      <StockQuantity value={available} />
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Dialokasikan penuh
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
