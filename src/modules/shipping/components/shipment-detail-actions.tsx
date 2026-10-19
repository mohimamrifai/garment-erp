"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { CancelDocumentDialog } from "@/modules/purchasing/components/cancel-document-dialog";
import { canCancelShipment, type ShipmentStatus } from "../status";

type ShipmentDetailActionsProps = {
  shipmentId: string;
  number: string;
  status: ShipmentStatus;
  canPost: boolean;
  canCancel: boolean;
};

/**
 * Aksi posting/pembatalan surat jalan. Posting mengeluarkan stok barang jadi
 * dan melepas alokasi item secara atomik di server.
 */
export function ShipmentDetailActions({
  shipmentId,
  number,
  status,
  canPost,
  canCancel,
}: ShipmentDetailActionsProps) {
  const router = useRouter();
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function post() {
    setPending(true);
    try {
      await requestJson(`/api/v1/shipments/${shipmentId}/post`, { method: "POST" });
      toast.success(`Pengiriman ${number} diposting; stok barang jadi telah dikurangi.`);
      setPostOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memposting pengiriman.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canCancel && canCancelShipment(status) ? (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
      ) : null}
      {canPost && canCancelShipment(status) ? (
        <Button onClick={() => setPostOpen(true)}>
          <CheckCircle2 data-icon="inline-start" />
          Posting Pengiriman
        </Button>
      ) : null}

      <AlertDialog open={postOpen} onOpenChange={setPostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Posting {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stok barang jadi di lokasi asal akan berkurang dan alokasi item pesanan dilepas.
              Setelah diposting, pengiriman tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Tidak jadi</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void post();
              }}
              disabled={pending}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Posting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelDocumentDialog
        endpoint={`/api/v1/shipments/${shipmentId}/cancel`}
        number={number}
        description="Pengiriman draf yang dibatalkan tidak mengurangi stok dan tidak dapat diposting lagi."
        successMessage={`Pengiriman ${number} dibatalkan.`}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
