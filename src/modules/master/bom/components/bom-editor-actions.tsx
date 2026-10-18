"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CopyPlus, Ban } from "lucide-react";
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
import type { Bom } from "../service";

type BomEditorActionsProps = {
  bomId: string;
  version: number;
  isActive: boolean;
  itemCount: number;
};

/** Aksi pada halaman editor BOM: aktifkan / nonaktifkan / salin versi baru. */
export function BomEditorActions({ bomId, version, isActive, itemCount }: BomEditorActionsProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"activate" | "deactivate" | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: "activate" | "deactivate") {
    setPending(true);
    try {
      await requestJson(`/api/v1/master/boms/${bomId}/${action}`, { method: "POST" });
      toast.success(action === "activate" ? `BOM v${version} diaktifkan.` : `BOM v${version} dinonaktifkan.`);
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
      const created = await requestJson<Bom>(`/api/v1/master/boms/${bomId}/version`, {
        method: "POST",
      });
      toast.success(`Draf versi v${created.version} dibuat dari v${version}.`);
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
      {isActive ? (
        <>
          <Button variant="outline" disabled={pending} onClick={createVersion}>
            <CopyPlus data-icon="inline-start" />
            Buat Versi Baru
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setConfirm("deactivate")}>
            <Ban data-icon="inline-start" />
            Nonaktifkan
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" disabled={pending} onClick={createVersion}>
            <CopyPlus data-icon="inline-start" />
            Buat Versi Baru
          </Button>
          <Button disabled={itemCount === 0 || pending} onClick={() => setConfirm("activate")}>
            <CheckCircle2 data-icon="inline-start" />
            Aktifkan BOM
          </Button>
        </>
      )}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => setConfirm(next ? confirm : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "activate" ? `Aktifkan BOM v${version}?` : `Nonaktifkan BOM v${version}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "activate"
                ? "Versi aktif varian ini akan digantikan. BOM aktif bersifat beku — revisi berikutnya lewat versi baru."
                : "Varian ini tidak akan punya BOM aktif sampai versi lain diaktifkan."}
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
