"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { canCancelSo, canConfirmSo, type SalesOrderStatus } from "../status";
import { CancelSoDialog } from "./cancel-so-dialog";

type SoRowActionsProps = {
  order: { id: string; number: string; status: SalesOrderStatus };
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
};

/** Menu aksi per baris daftar sales order. */
export function SoRowActions({ order, canUpdate, canConfirm, canCancel }: SoRowActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmOrder() {
    setPending(true);
    try {
      await requestJson(`/api/v1/sales-orders/${order.id}/confirm`, { method: "POST" });
      toast.success(`Sales order ${order.number} dikonfirmasi.`);
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengonfirmasi pesanan.");
    } finally {
      setPending(false);
    }
  }

  const showEdit = canUpdate && order.status === "DRAFT";
  const showConfirm = canConfirm && canConfirmSo(order.status);
  const showCancel = canCancel && canCancelSo(order.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Aksi ${order.number}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{order.number}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/sales/${order.id}`)}>
              Lihat detail
            </DropdownMenuItem>
            {showEdit ? (
              <DropdownMenuItem onClick={() => router.push(`/sales/${order.id}/edit`)}>
                Ubah
              </DropdownMenuItem>
            ) : null}
            {showConfirm ? (
              <DropdownMenuItem onClick={() => setConfirmOpen(true)}>Konfirmasi</DropdownMenuItem>
            ) : null}
            {showCancel ? (
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                Batalkan
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi {order.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pesanan yang dikonfirmasi tidak dapat diubah lagi dan siap masuk tahap produksi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirmOrder}>
              Konfirmasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelSoDialog
        salesOrderId={order.id}
        number={order.number}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
