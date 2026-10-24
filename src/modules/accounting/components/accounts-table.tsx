import { BookOpenCheck } from "lucide-react";
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
import { cn } from "cn";
import type { Account } from "@/lib/db/schema";
import { ACCOUNT_TYPE_LABELS } from "../schemas";
import { AccountRowActions } from "./account-row-actions";

export function AccountsTable({
  accounts,
  canManage,
}: {
  accounts: Account[];
  canManage: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada akun</EmptyTitle>
          <EmptyDescription>
            Tambahkan akun bagan akun atau gunakan akun bawaan yang dibuat otomatis.
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
            <TableHead>Kode</TableHead>
            <TableHead>Nama Akun</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Saldo Normal</TableHead>
            <TableHead>Kas/Bank</TableHead>
            <TableHead>Status</TableHead>
            {canManage ? <TableHead className="text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono text-[12px] font-medium">{account.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{account.name}</span>
                  {account.bankName ? (
                    <span className="text-[11px] text-muted-foreground">
                      {account.bankName}
                      {account.accountNumber ? ` · ${account.accountNumber}` : ""}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-[13px]">{ACCOUNT_TYPE_LABELS[account.type]}</TableCell>
              <TableCell className="font-mono text-[12px]">
                {account.normalBalance === "DEBIT" ? "Debit" : "Kredit"}
              </TableCell>
              <TableCell>
                {account.isCashBank ? (
                  <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                    Kas/Bank
                  </Badge>
                ) : (
                  <span className="text-[12px] text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    account.isActive
                      ? "border-success/30 bg-success/10 text-success"
                      : "text-muted-foreground",
                  )}
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {account.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              {canManage ? (
                <TableCell>
                  <AccountRowActions account={account} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
