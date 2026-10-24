import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr } from "@/lib/utils/currency";
import type { Payslip } from "@/lib/db/schema";

export function PayslipsTable({ payslips }: { payslips: Payslip[] }) {
  const totals = payslips.reduce(
    (accumulator, slip) => ({
      gross: accumulator.gross + Number(slip.gross),
      deductions: accumulator.deductions + Number(slip.totalDeductions),
      net: accumulator.net + Number(slip.net),
    }),
    { gross: 0, deductions: 0, net: 0 },
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Karyawan</TableHead>
            <TableHead>Departemen</TableHead>
            <TableHead className="text-right">Gaji Pokok</TableHead>
            <TableHead className="text-right">Tunjangan</TableHead>
            <TableHead className="text-right">Lembur</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Potongan</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead>Bank</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payslips.map((slip) => (
            <TableRow key={slip.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{slip.employeeName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {slip.employeeCode} · {slip.jobTitle}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-[13px]">{slip.departmentName}</TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {formatIdr(slip.basicSalary)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {formatIdr(slip.fixedAllowance)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {formatIdr(slip.overtimePay)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                {formatIdr(slip.gross)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums text-destructive">
                {formatIdr(slip.totalDeductions)}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] font-medium tabular-nums">
                {formatIdr(slip.net)}
              </TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {slip.bankName ? `${slip.bankName} · ${slip.bankAccountNumber ?? "-"}` : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="text-right font-medium">
              Total
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums">
              {formatIdr(totals.gross)}
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums">
              {formatIdr(totals.deductions)}
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums">
              {formatIdr(totals.net)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
