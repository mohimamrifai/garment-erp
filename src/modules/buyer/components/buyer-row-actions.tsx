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
import type { Buyer } from "../service";
import { BuyerFormDialog } from "./buyer-form-dialog";

export function BuyerRowActions({ buyer }: { buyer: Buyer }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleStatus() {
    setPending(true);
    try {
      await requestJson(`/api/v1/buyers/${buyer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !buyer.isActive }),
      });
      toast.success(buyer.isActive ? "Buyer dinonaktifkan." : "Buyer diaktifkan kembali.");
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${buyer.name}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialog("edit")}>Ubah</DropdownMenuItem>
            <DropdownMenuItem
              variant={buyer.isActive ? "destructive" : "default"}
              onClick={() => setDialog("toggle")}
            >
              {buyer.isActive ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "edit" ? (
        <BuyerFormDialog
          open
          buyer={buyer}
          onOpenChange={(next) => setDialog(next ? "edit" : null)}
        />
      ) : null}

      <AlertDialog
        open={dialog === "toggle"}
        onOpenChange={(next) => setDialog(next ? "toggle" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {buyer.isActive ? "Nonaktifkan buyer?" : "Aktifkan kembali buyer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {buyer.isActive
                ? `${buyer.name} tidak akan muncul saat membuat sales order baru. Data lama tetap tersimpan.`
                : `${buyer.name} akan kembali tersedia untuk transaksi baru.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant={buyer.isActive ? "destructive" : "default"}
              disabled={pending}
              onClick={toggleStatus}
            >
              {buyer.isActive ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
