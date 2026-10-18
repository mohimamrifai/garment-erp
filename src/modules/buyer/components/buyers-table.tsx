"use client";

import { Handshake } from "lucide-react";
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
import type { Buyer } from "../service";
import { BuyerRowActions } from "./buyer-row-actions";

export function BuyersTable({ buyers, canWrite }: { buyers: Buyer[]; canWrite: boolean }) {
  if (buyers.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <Handshake />
          </EmptyMedia>
          <EmptyTitle>Belum ada buyer</EmptyTitle>
          <EmptyDescription>
            Tambahkan buyer pertama atau ubah filter pencarian Anda.
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
            <TableHead className="w-28">Kode</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Status</TableHead>
            {canWrite ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {buyers.map((buyer) => (
            <TableRow key={buyer.id}>
              <TableCell className="font-mono text-xs">{buyer.code}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{buyer.name}</span>
                  {buyer.address ? (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {buyer.address}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{buyer.contactPerson ?? "-"}</span>
                  <span className="text-xs text-muted-foreground">
                    {[buyer.phone, buyer.email].filter(Boolean).join(" · ") || "-"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {buyer.isActive ? (
                  <Badge variant="outline">Aktif</Badge>
                ) : (
                  <Badge variant="destructive">Nonaktif</Badge>
                )}
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <BuyerRowActions buyer={buyer} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
