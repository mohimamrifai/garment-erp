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
  canCancelReceipt,
  canPostReceipt,
  isEditableReceiptStatus,
  type MaterialReceiptStatus,
} from "../status";
import { CancelDocumentDialog } from "./cancel-document-dialog";

type ReceiptRowActionsProps = {
  receipt: { id: string; number: string; status: MaterialReceiptStatus };
  canUpdate: boolean;
  canPost: boolean;
  canCancel: boolean;
};

/** Menu aksi per baris daftar penerimaan material. */
export function ReceiptRowActions({
  receipt,
  canUpdate,
  canPost,
  canCancel,
}: ReceiptRowActionsProps) {
  const router = useRouter();
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function postReceipt() {
    setPending(true);
    try {
      await requestJson(`/api/v1/material-receipts/${receipt.id}/post`, { method: "POST" });
      toast.success(`Penerimaan ${receipt.number} diposting — stok bertambah.`);
      setPostOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal memposting penerimaan.");
    } finally {
      setPending(false);
    }
  }

  const showEdit = canUpdate && isEditableReceiptStatus(receipt.status);
  const showPost = canPost && canPostReceipt(receipt.status);
  const showCancel = canCancel && canCancelReceipt(receipt.status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi ${receipt.number}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{receipt.number}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/purchasing/receipts/${receipt.id}`)}>
              Lihat detail
            </DropdownMenuItem>
            {showEdit ? (
              <DropdownMenuItem
                onClick={() => router.push(`/purchasing/receipts/${receipt.id}/edit`)}
              >
                Ubah
              </DropdownMenuItem>
            ) : null}
            {showPost ? (
              <DropdownMenuItem onClick={() => setPostOpen(true)}>Posting</DropdownMenuItem>
            ) : null}
            {showCancel ? (
              <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
                Batalkan
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={postOpen} onOpenChange={setPostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Posting {receipt.number}?</AlertDialogTitle>
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
        endpoint={`/api/v1/material-receipts/${receipt.id}/cancel`}
        number={receipt.number}
        description="Penerimaan yang dibatalkan tidak dihitung sebagai penerimaan barang. Tindakan ini tercatat di audit log."
        successMessage={`Penerimaan ${receipt.number} dibatalkan.`}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
