"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import type { LeaveRequestListRow } from "../service";

export function LeaveActions({
  request,
  canApprove,
  canCancel,
}: {
  request: LeaveRequestListRow;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body?: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      await requestJson(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      toast.success("Status pengajuan cuti diperbarui.");
      setApproveOpen(false);
      setRejectOpen(false);
      setCancelOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal memproses pengajuan cuti.");
    } finally {
      setPending(false);
    }
  }

  if (request.status === "PENDING" && canApprove) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Setujui cuti ${request.employeeName}`}
          onClick={() => setApproveOpen(true)}
        >
          <CheckCircle2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Tolak cuti ${request.employeeName}`}
          onClick={() => setRejectOpen(true)}
        >
          <XCircle />
        </Button>
        {canCancel ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Batalkan cuti ${request.employeeName}`}
            onClick={() => setCancelOpen(true)}
          >
            <Ban />
          </Button>
        ) : null}

        <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Setujui pengajuan cuti?</AlertDialogTitle>
              <AlertDialogDescription>
                Cuti {request.leaveTypeName} untuk {request.employeeName} selama {request.days} hari
                akan disetujui dan dipakai pada perhitungan payroll.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void act(`/api/v1/hr/leave-requests/${request.id}/approve`);
                }}
                disabled={pending}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Setujui
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tolak pengajuan cuti</DialogTitle>
              <DialogDescription>
                Berikan alasan penolakan agar karyawan mengetahui dasar keputusannya.
              </DialogDescription>
            </DialogHeader>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor={`leave-reject-${request.id}`}>Alasan penolakan</FieldLabel>
              <Textarea
                id={`leave-reject-${request.id}`}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending || reason.trim().length < 3}
                onClick={() =>
                  void act(`/api/v1/hr/leave-requests/${request.id}/reject`, { reason })
                }
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Tolak
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Batalkan pengajuan cuti?</AlertDialogTitle>
              <AlertDialogDescription>
                Pengajuan cuti {request.number} akan dibatalkan dan tidak dihitung pada payroll.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Tidak</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void act(`/api/v1/hr/leave-requests/${request.id}/cancel`);
                }}
                disabled={pending}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Batalkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (request.status === "APPROVED" && canCancel) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Batalkan cuti yang disetujui?</AlertDialogTitle>
              <AlertDialogDescription>
                Cuti {request.number} akan dibatalkan. Jika payroll sudah dibuat, buat ulang payroll
                agar potongan cuti ikut diperbarui.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Tidak</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void act(`/api/v1/hr/leave-requests/${request.id}/cancel`);
                }}
                disabled={pending}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Batalkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return null;
}
