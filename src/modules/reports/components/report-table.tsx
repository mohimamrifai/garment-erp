import { FileSearch } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";
import { formatDateId } from "@/lib/utils/dates";
import type { ReportColumn, ReportRow } from "../service";

type ReportTableProps = {
  columns: readonly ReportColumn[];
  rows: readonly ReportRow[];
};

function formatCell(column: ReportColumn, value: ReportRow[string]): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (column.format) {
    case "date":
      return <span className="whitespace-nowrap">{formatDateId(String(value))}</span>;
    case "number":
      return <span className="font-mono tabular-nums">{Number(value).toLocaleString("id-ID")}</span>;
    case "percent":
      return (
        <span className="font-mono tabular-nums">
          {Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
        </span>
      );
    default:
      return String(value);
  }
}

/** Tabel laporan generik — kolom & format mengikuti definisi laporan. */
export function ReportTable({ columns, rows }: ReportTableProps) {
  if (rows.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch />
          </EmptyMedia>
          <EmptyTitle>Tidak ada data pada periode ini</EmptyTitle>
          <EmptyDescription>
            Ubah rentang tanggal atau pilih laporan lain untuk melihat data.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn("whitespace-nowrap", column.align === "right" && "text-right")}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "align-top text-[13px]",
                    column.align === "right" && "text-right",
                  )}
                >
                  {formatCell(column, row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
