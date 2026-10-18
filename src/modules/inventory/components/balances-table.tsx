import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQty } from "@/lib/utils/currency";
import type { InventoryBalanceListRow } from "../service";
import { ItemTypeBadge } from "./inventory-badges";

type BalancesTableProps = {
  balances: InventoryBalanceListRow[];
};

function isLowStock(balance: InventoryBalanceListRow): boolean {
  if (balance.itemType !== "MATERIAL") return false;
  if (balance.minimumStock === null) return false;
  const minimum = Number(balance.minimumStock);
  if (minimum <= 0) return false;
  return Number(balance.quantityOnHand) < minimum;
}

/** Tabel saldo stok per material/varian dan lokasi penyimpanan. */
export function BalancesTable({ balances }: BalancesTableProps) {
  if (balances.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Boxes />
          </EmptyMedia>
          <EmptyTitle>Belum ada saldo stok</EmptyTitle>
          <EmptyDescription>
            Saldo bertambah setelah penerimaan material diposting atau penyesuaian stok dicatat.
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
            <TableHead>Item</TableHead>
            <TableHead className="w-28">Tipe</TableHead>
            <TableHead className="w-52">Lokasi</TableHead>
            <TableHead className="w-28 text-right">Stok Fisik</TableHead>
            <TableHead className="w-28 text-right">Direservasi</TableHead>
            <TableHead className="w-28 text-right">Tersedia</TableHead>
            <TableHead className="w-40">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.map((balance) => {
            const low = isLowStock(balance);
            const primary =
              balance.itemType === "MATERIAL"
                ? (balance.materialName ?? "—")
                : (balance.productName ?? "—");
            const secondary =
              balance.itemType === "MATERIAL"
                ? `${balance.materialCode ?? "—"} · ${balance.unitCode ?? ""}`
                : `${balance.variantSku ?? "—"} · ${balance.size ?? ""}/${balance.color ?? ""}`;
            return (
              <TableRow key={balance.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{primary}</span>
                    <span className="nums font-mono text-[11px] text-muted-foreground">
                      {secondary}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <ItemTypeBadge itemType={balance.itemType} />
                </TableCell>
                <TableCell className="text-[13px]">
                  {balance.warehouseName}
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {balance.locationCode} · {balance.locationName}
                  </span>
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {formatQty(balance.quantityOnHand)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                  {formatQty(balance.quantityReserved)}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm">
                  {formatQty(balance.quantityAvailable)}
                </TableCell>
                <TableCell>
                  {low ? (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                      Di bawah minimum
                    </Badge>
                  ) : balance.itemType === "MATERIAL" && Number(balance.minimumStock) > 0 ? (
                    <span className="nums font-mono text-[11px] text-muted-foreground">
                      min. {formatQty(balance.minimumStock ?? "0")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
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
