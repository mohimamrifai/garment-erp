"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatQty } from "@/lib/utils/currency";
import type { BomItemRow } from "../service";

function BomItemDelete({ item }: { item: BomItemRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await requestJson(`/api/v1/master/bom-items/${item.id}`, { method: "DELETE" });
      toast.success(`Material ${item.materialCode} dihapus dari BOM.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal menghapus item.");
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Hapus ${item.materialName} dari BOM`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus item dari BOM?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.materialCode} — {item.materialName} akan dihapus dari draf BOM ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function BomItemsTable({
  items,
  canWrite,
  editable,
}: {
  items: BomItemRow[];
  canWrite: boolean;
  /** Draf BOM: item dapat dihapus. BOM aktif bersifat beku. */
  editable: boolean;
}) {
  if (items.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>Belum ada item material</EmptyTitle>
          <EmptyDescription>
            Tambahkan material yang dibutuhkan untuk memproduksi satu unit varian ini.
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
            <TableHead>Material</TableHead>
            <TableHead className="w-28">Satuan</TableHead>
            <TableHead className="w-32 text-right">Per Unit</TableHead>
            <TableHead className="w-32 text-right">Cadangan</TableHead>
            <TableHead>Catatan</TableHead>
            {canWrite && editable ? <TableHead className="w-12 text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{item.materialName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.materialCode}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-foreground/70">{item.unitCode}</TableCell>
              <TableCell className="nums text-right font-mono text-sm">
                {formatQty(item.quantityPerUnit)}
              </TableCell>
              <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                {formatQty(item.scrapAllowance)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{item.notes ?? "—"}</TableCell>
              {canWrite && editable ? (
                <TableCell className="text-right">
                  <BomItemDelete item={item} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
