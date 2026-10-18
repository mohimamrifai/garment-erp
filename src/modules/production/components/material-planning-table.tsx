import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQty } from "@/lib/utils/currency";
import type { MaterialPlanningSummary } from "../service";

type MaterialPlanningTableProps = {
  planning: MaterialPlanningSummary;
  productionOrderId: string;
  canCreatePo: boolean;
};

/**
 * Tabel kebutuhan material (PRD FR-07): bruto, cadangan, tersedia, terjadwal,
 * kekurangan — plus tombol "Buat PO" yang mem-prefill item dari kekurangan.
 */
export function MaterialPlanningTable({
  planning,
  productionOrderId,
  canCreatePo,
}: MaterialPlanningTableProps) {
  const shortages = planning.rows.filter((row) => row.shortageQuantity > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {planning.rows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              BOM SPK ini belum memiliki item material.
            </p>
          ) : planning.hasShortage ? (
            <>
              <AlertTriangle className="size-4 text-warning" />
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                Kurang {planning.shortageCount} material
              </Badge>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 text-success" />
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                Material cukup
              </Badge>
            </>
          )}
        </div>
        {canCreatePo && shortages.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/purchasing/new?spk=${productionOrderId}`} />}
          >
            Buat PO dari Kekurangan
          </Button>
        ) : null}
      </div>

      {planning.rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-28 text-right">Per Unit</TableHead>
                <TableHead className="w-24 text-right">Cadangan</TableHead>
                <TableHead className="w-28 text-right">Bruto</TableHead>
                <TableHead className="w-28 text-right">Tersedia</TableHead>
                <TableHead className="w-28 text-right">Terjadwal</TableHead>
                <TableHead className="w-28 text-right">Kekurangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planning.rows.map((row) => (
                <TableRow key={row.materialId}>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <span className="nums block font-mono text-[11px] text-muted-foreground">
                      {row.code} · {row.unitCode}
                    </span>
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                    {formatQty(row.quantityPerUnit)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                    {formatQty(row.allowanceQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(row.grossQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(row.availableQuantity)}
                  </TableCell>
                  <TableCell className="nums text-right font-mono text-sm">
                    {formatQty(row.scheduledQuantity)}
                  </TableCell>
                  <TableCell
                    className={
                      row.shortageQuantity > 0
                        ? "nums text-right font-mono text-sm font-medium text-destructive"
                        : "nums text-right font-mono text-sm text-muted-foreground"
                    }
                  >
                    {formatQty(row.shortageQuantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium" colSpan={3}>
                  Total kekurangan
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="nums text-right font-mono text-sm font-medium">
                  {planning.shortageCount} item
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
