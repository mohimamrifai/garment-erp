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
import {
  canCancelPurchaseOrder,
  canOrderPurchaseOrder,
  canReceivePurchaseOrder,
  isEditablePurchaseOrderStatus,
  type PurchaseOrderStatus,
} from "../status";
import { CancelDocumentDialog } from "./cancel-document-dialog";

type PoRowActionsProps = {
  order: { id: string; number: string; status: PurchaseOrderStatus };
  canUpdate: boolean;
  canOrder: boolean;
  canCancel: boolean;
  canReceive: boolean;
};

/** Menu aksi per baris daftar purchase order. */
export function PoRowActions({
  order,
  canUpdate,
  canOrder,
  canCancel,
  canReceive,
}: PoRowActionsProps) {
  const router = useRouter();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function placeOrder() {
    setPending(true);
    try {
      await requestJson(`/api/v1/purchase-orders/${order.id}/order`, { method: "POST" });
      toast.success(`Purchase order ${order.number} dipesan ke supplier.`);
      setOrderDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memesan purchase order.");
    } finally {
      setPending(false);
    }
  }

  const showEdit = canUpdate && isEditablePurchaseOrderStatus(order.status);
  const showOrder = canOrder && canOrderPurchaseOrder(order.status);
  const showReceive = canReceive && canReceivePurchaseOrder(order.status);
  const showCancel = canCancel && canCancelPurchaseOrder(order.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi ${order.number}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{order.number}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/purchasing/${order.id}`)}>
              Lihat detail
            </DropdownMenuItem>
            {showEdit ? (
              <DropdownMenuItem onClick={() => router.push(`/purchasing/${order.id}/edit`)}>
                Ubah
              </DropdownMenuItem>
            ) : null}
            {showOrder ? (
              <DropdownMenuItem onClick={() => setOrderDialogOpen(true)}>
                Pesan ke supplier
              </DropdownMenuItem>
            ) : null}
            {showReceive ? (
              <DropdownMenuItem
                onClick={() => router.push(`/purchasing/receipts/new?po=${order.id}`)}
              >
                Terima barang
              </DropdownMenuItem>
            ) : null}
            {showCancel ? (
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                Batalkan
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pesan {order.number} ke supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Purchase order yang sudah dipesan tidak dapat diubah lagi dan siap menerima barang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={placeOrder}>
              Pesan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelDocumentDialog
        endpoint={`/api/v1/purchase-orders/${order.id}/cancel`}
        number={order.number}
        description="Purchase order yang dibatalkan tidak dapat dipesan atau diterima lagi. Tindakan ini tercatat di audit log."
        successMessage={`Purchase order ${order.number} dibatalkan.`}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
