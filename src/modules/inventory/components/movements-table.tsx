import { ArrowLeftRight } from "lucide-react";
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
import { formatQty } from "@/lib/utils/currency";
import { formatDateId, formatTimeId } from "@/lib/utils/dates";
import type { InventoryTransactionListRow } from "../service";
import { TransactionTypeBadge } from "./inventory-badges";

type MovementsTableProps = {
  transactions: InventoryTransactionListRow[];
};

/** Arah kuantitas per jenis mutasi: masuk (+), keluar (−), transfer netral. */
function signedQuantity(transaction: InventoryTransactionListRow): string {
  if (
    transaction.transactionType === "RECEIPT" ||
    transaction.transactionType === "ADJUSTMENT_IN"
  ) {
    return `+${formatQty(transaction.quantity)}`;
  }
  if (transaction.transactionType === "ISSUE" || transaction.transactionType === "ADJUSTMENT_OUT") {
    return `−${formatQty(transaction.quantity)}`;
  }
  return formatQty(transaction.quantity);
}

/** Tabel riwayat mutasi stok (append-only) dengan filter dari server. */
export function MovementsTable({ transactions }: MovementsTableProps) {
  if (transactions.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ArrowLeftRight />
          </EmptyMedia>
          <EmptyTitle>Belum ada mutasi stok</EmptyTitle>
          <EmptyDescription>
            Setiap penerimaan, pengeluaran, transfer, dan penyesuaian stok tercatat di sini.
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
            <TableHead className="w-44">Waktu</TableHead>
            <TableHead className="w-36">Nomor</TableHead>
            <TableHead className="w-36">Tipe</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="w-56">Lokasi</TableHead>
            <TableHead className="w-20 text-right">Jumlah</TableHead>
            <TableHead className="w-44">Referensi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const primary =
              transaction.itemType === "MATERIAL"
                ? (transaction.materialName ?? "—")
                : (transaction.productName ?? "—");
            const secondary =
              transaction.itemType === "MATERIAL"
                ? transaction.materialCode
                : transaction.variantSku;
            const unit = transaction.itemType === "MATERIAL" ? (transaction.unitCode ?? "") : "PCS";
            return (
              <TableRow key={transaction.id}>
                <TableCell className="nums font-mono text-xs text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{formatDateId(transaction.postedAt)}</span>
                    <span className="text-[11px]">
                      {formatTimeId(transaction.postedAt)} WIB ·{" "}
                      {transaction.postedByName ?? "Sistem"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="nums font-mono text-[13px] font-medium">
                  {transaction.number}
                </TableCell>
                <TableCell>
                  <TransactionTypeBadge type={transaction.transactionType} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{primary}</span>
                    <span className="nums font-mono text-[11px] text-muted-foreground">
                      {secondary ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {transaction.fromLocationLabel || transaction.toLocationLabel ? (
                    <div className="flex flex-col gap-0.5">
                      {transaction.fromLocationLabel ? (
                        <span>Dari {transaction.fromLocationLabel}</span>
                      ) : null}
                      {transaction.toLocationLabel ? (
                        <span>Ke {transaction.toLocationLabel}</span>
                      ) : null}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  <span className="inline-flex items-baseline justify-end gap-1">
                    {signedQuantity(transaction)}
                    {unit ? (
                      <span className="text-[10px] font-normal tracking-wide text-muted-foreground">
                        {unit}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {transaction.notes ? (
                    <span className="block max-w-44 truncate" title={transaction.notes}>
                      {transaction.notes}
                    </span>
                  ) : (
                    "—"
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
