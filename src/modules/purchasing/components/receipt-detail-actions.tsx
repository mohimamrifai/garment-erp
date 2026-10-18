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
import { canCancelReceipt, canPostReceipt, isEditableReceiptStatus, type MaterialReceiptStatus } from "../status";
import { CancelDocumentDialog } from "./cancel-document-dialog";

type ReceiptDetailActionsProps = {
  materialReceiptId: string;
  number: string;
  status: MaterialReceiptStatus;
  canUpdate: boolean;
  canPost: boolean;
  canCancel: boolean;
};

/** Tombol aksi pada header halaman detail penerimaan material. */
export function ReceiptDetailActions({
  materialReceiptId,
  number,
  status,
  canUpdate,
  canPost,
  canCancel,
}: ReceiptDetailActionsProps) {
  const router = useRouter();
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function postReceipt() {
    setPending(true);
    try {
      await requestJson(`/api/v1/material-receipts/${materialReceiptId}/post`, { method: "POST" });
      toast.success(`Penerimaan ${number} diposting — stok bertambah.`);
      setPostOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memposting penerimaan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canUpdate && isEditableReceiptStatus(status) ? (
        <Button
          variant="outline"
          render={<Link href={`/purchasing/receipts/${materialReceiptId}/edit`} />}
        >
          <Pencil data-icon="inline-start" />
          Ubah
        </Button>
      ) : null}
      {canCancel && canCancelReceipt(status) ? (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
      ) : null}
      {canPost && canPostReceipt(status) ? (
        <Button onClick={() => setPostOpen(true)}>
          <CheckCircle2 data-icon="inline-start" />
          Posting
        </Button>
      ) : null}

      <AlertDialog open={postOpen} onOpenChange={setPostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Posting {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Setelah diposting, stok bertambah dan dokumen tidak dapat diubah atau dibatalkan lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={postReceipt}>
              Posting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelDocumentDialog
        endpoint={`/api/v1/material-receipts/${materialReceiptId}/cancel`}
        number={number}
        description="Penerimaan yang dibatalkan tidak dihitung sebagai penerimaan barang. Tindakan ini tercatat di audit log."
        successMessage={`Penerimaan ${number} dibatalkan.`}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
