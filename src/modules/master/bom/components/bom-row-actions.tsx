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
import type { Bom, BomListRow } from "../service";

export function BomRowActions({ bom }: { bom: BomListRow }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"activate" | "deactivate" | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: "activate" | "deactivate") {
    setPending(true);
    try {
      await requestJson(`/api/v1/master/boms/${bom.id}/${action}`, { method: "POST" });
      toast.success(
        action === "activate"
          ? `BOM ${bom.variantSku} v${bom.version} diaktifkan.`
          : `BOM ${bom.variantSku} v${bom.version} dinonaktifkan.`,
      );
      setConfirm(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal mengubah status BOM.");
      setConfirm(null);
    } finally {
      setPending(false);
    }
  }

  async function createVersion() {
    setPending(true);
    try {
      const created = await requestJson<Bom>(`/api/v1/master/boms/${bom.id}/version`, {
        method: "POST",
      });
      toast.success(`Draf versi v${created.version} dibuat dari v${bom.version}.`);
      router.push(`/master/bom/${created.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membuat versi baru.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Aksi BOM ${bom.variantSku} v${bom.version}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Aksi BOM</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/master/bom/${bom.id}`)}>
              Buka editor
            </DropdownMenuItem>
            {bom.isActive ? (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("deactivate")}>
                Nonaktifkan
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setConfirm("activate")}>Aktifkan</DropdownMenuItem>
                <DropdownMenuItem disabled={pending} onClick={createVersion}>
                  Buat versi baru
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => setConfirm(next ? confirm : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "activate"
                ? `Aktifkan BOM v${bom.version}?`
                : `Nonaktifkan BOM v${bom.version}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "activate"
                ? `Versi aktif varian ${bom.variantSku} akan digantikan oleh v${bom.version}. BOM aktif bersifat beku — revisi berikutnya lewat versi baru.`
                : `Varian ${bom.variantSku} tidak akan punya BOM aktif sampai versi lain diaktifkan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "deactivate" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => run(confirm === "activate" ? "activate" : "deactivate")}
            >
              {confirm === "activate" ? "Aktifkan" : "Nonaktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
