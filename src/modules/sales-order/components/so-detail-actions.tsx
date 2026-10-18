"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Pencil } from "lucide-react";
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
import { canCancelSo, canConfirmSo, type SalesOrderStatus } from "../status";
import { CancelSoDialog } from "./cancel-so-dialog";

type SoDetailActionsProps = {
  salesOrderId: string;
  number: string;
  status: SalesOrderStatus;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
};

/** Tombol aksi pada header halaman detail sales order. */
export function SoDetailActions({
  salesOrderId,
  number,
  status,
  canUpdate,
  canConfirm,
  canCancel,
}: SoDetailActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmOrder() {
    setPending(true);
    try {
      await requestJson(`/api/v1/sales-orders/${salesOrderId}/confirm`, { method: "POST" });
      toast.success(`Sales order ${number} dikonfirmasi.`);
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengonfirmasi pesanan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canUpdate && status === "DRAFT" ? (
        <Button variant="outline" render={<Link href={`/sales/${salesOrderId}/edit`} />}>
          <Pencil data-icon="inline-start" />
          Ubah
        </Button>
      ) : null}
      {canCancel && canCancelSo(status) ? (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
      ) : null}
      {canConfirm && canConfirmSo(status) ? (
        <Button onClick={() => setConfirmOpen(true)}>
          <CheckCircle2 data-icon="inline-start" />
          Konfirmasi
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi {number}?</AlertDialogTitle>
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
        salesOrderId={salesOrderId}
        number={number}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
