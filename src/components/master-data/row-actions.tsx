"use client";

import { useState, type ReactNode } from "react";
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

type MasterRowActionsProps = {
  /** Endpoint PATCH untuk toggle status, mis. `/api/v1/master/departments/<id>`. */
  endpoint: string;
  isActive: boolean;
  /** Nama entitas untuk toast & konfirmasi, mis. "Departemen". */
  entityName: string;
  /** Nama item untuk pesan konfirmasi. */
  itemName: string;
  /** Dialog ubah (open state dikelola di sini). */
  renderEditDialog: (dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => ReactNode;
  /** Kalimat dampak saat nonaktif, mis. "tidak muncul di pilihan material baru". */
  deactivateHint?: string;
  /** Body PATCH kustom untuk toggle status (default `{ isActive }`). */
  buildToggleBody?: (next: boolean) => Record<string, unknown>;
};

/**
 * Aksi baris standar master data: Ubah + Aktifkan/Nonaktifkan (soft delete).
 * Data master tidak pernah dihapus permanen — hanya dinonaktifkan.
 */
export function MasterRowActions({
  endpoint,
  isActive,
  entityName,
  itemName,
  renderEditDialog,
  deactivateHint = "data lama tetap tersimpan.",
  buildToggleBody,
}: MasterRowActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleStatus() {
    setPending(true);
    try {
      await requestJson(endpoint, {
        method: "PATCH",
        body: JSON.stringify(buildToggleBody ? buildToggleBody(!isActive) : { isActive: !isActive }),
      });
      toast.success(isActive ? `${entityName} dinonaktifkan.` : `${entityName} diaktifkan kembali.`);
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
          render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${itemName}`} />}
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
              variant={isActive ? "destructive" : "default"}
              onClick={() => setDialog("toggle")}
            >
              {isActive ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "edit" ? renderEditDialog({ open: true, onOpenChange: () => setDialog(null) }) : null}

      <AlertDialog
        open={dialog === "toggle"}
        onOpenChange={(next) => setDialog(next ? "toggle" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? `Nonaktifkan ${entityName.toLowerCase()}?` : `Aktifkan kembali?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? `${itemName} akan disembunyikan dari pilihan transaksi baru — ${deactivateHint}`
                : `${itemName} akan kembali tersedia untuk transaksi baru.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant={isActive ? "destructive" : "default"}
              disabled={pending}
              onClick={toggleStatus}
            >
              {isActive ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
