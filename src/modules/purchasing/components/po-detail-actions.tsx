"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, PackageCheck, Pencil, Send } from "lucide-react";
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
import { ApiRequestError, requestJson } from "@/lib/api/client";
import {
  canCancelPurchaseOrder,
  canOrderPurchaseOrder,
  canReceivePurchaseOrder,
  isEditablePurchaseOrderStatus,
  type PurchaseOrderStatus,
} from "../status";
import { CancelDocumentDialog } from "./cancel-document-dialog";

type PoDetailActionsProps = {
  purchaseOrderId: string;
  number: string;
  status: PurchaseOrderStatus;
  canUpdate: boolean;
  canOrder: boolean;
  canCancel: boolean;
  canReceive: boolean;
};

/** Tombol aksi pada header halaman detail purchase order. */
export function PoDetailActions({
  purchaseOrderId,
  number,
  status,
  canUpdate,
  canOrder,
  canCancel,
  canReceive,
}: PoDetailActionsProps) {
  const router = useRouter();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function placeOrder() {
    setPending(true);
    try {
      await requestJson(`/api/v1/purchase-orders/${purchaseOrderId}/order`, { method: "POST" });
      toast.success(`Purchase order ${number} dipesan ke supplier.`);
      setOrderDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memesan purchase order.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canUpdate && isEditablePurchaseOrderStatus(status) ? (
        <Button variant="outline" render={<Link href={`/purchasing/${purchaseOrderId}/edit`} />}>
          <Pencil data-icon="inline-start" />
          Ubah
        </Button>
      ) : null}
      {canCancel && canCancelPurchaseOrder(status) ? (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
      ) : null}
      {canOrder && canOrderPurchaseOrder(status) ? (
        <Button onClick={() => setOrderDialogOpen(true)}>
          <Send data-icon="inline-start" />
          Pesan ke Supplier
        </Button>
      ) : null}
      {canReceive && canReceivePurchaseOrder(status) ? (
        <Button render={<Link href={`/purchasing/receipts/new?po=${purchaseOrderId}`} />}>
          <PackageCheck data-icon="inline-start" />
          Terima Barang
        </Button>
      ) : null}

      <AlertDialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pesan {number} ke supplier?</AlertDialogTitle>
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
        endpoint={`/api/v1/purchase-orders/${purchaseOrderId}/cancel`}
        number={number}
        description="Purchase order yang dibatalkan tidak dapat dipesan atau diterima lagi. Tindakan ini tercatat di audit log."
        successMessage={`Purchase order ${number} dibatalkan.`}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
