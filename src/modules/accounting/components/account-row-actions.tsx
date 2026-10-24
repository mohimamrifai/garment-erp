"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power } from "lucide-react";
import { toast } from "sonner";
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
import type { Account } from "@/lib/db/schema";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountRowActions({ account }: { account: Account }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/v1/accounting/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      toast.success(account.isActive ? "Akun dinonaktifkan." : "Akun diaktifkan.");
      setToggleOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal mengubah status akun.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ubah akun ${account.name}`}
          onClick={() => setEditOpen(true)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={account.isActive ? `Nonaktifkan akun ${account.name}` : `Aktifkan akun ${account.name}`}
          onClick={() => setToggleOpen(true)}
        >
          <Power />
        </Button>
      </div>

      <AccountFormDialog account={account} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {account.isActive ? "Nonaktifkan akun ini?" : "Aktifkan akun ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {account.isActive
                ? "Akun nonaktif tidak dapat dipakai pada jurnal baru, tetapi riwayat jurnal tetap tersimpan."
                : "Akun akan tersedia kembali untuk jurnal dan pembayaran baru."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void toggle();
              }}
              disabled={pending}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {account.isActive ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
