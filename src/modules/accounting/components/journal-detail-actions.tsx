"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { getTodayDate } from "@/lib/utils/dates";

export function JournalDetailActions({
  journalId,
  number,
  status,
  canPost,
}: {
  journalId: string;
  number: string;
  status: string;
  canPost: boolean;
}) {
  const router = useRouter();
  const [postOpen, setPostOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayDate());
  const [reason, setReason] = useState("");

  async function post() {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/v1/accounting/journals/${journalId}/post`, { method: "POST" });
      toast.success(`Jurnal ${number} berhasil diposting.`);
      setPostOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal memposting jurnal.");
    } finally {
      setPending(false);
    }
  }

  async function reverse() {
    setPending(true);
    setError(null);
    try {
      const reversal = await requestJson<{ id: string; number: string }>(
        `/api/v1/accounting/journals/${journalId}/reverse`,
        {
          method: "POST",
          body: JSON.stringify({ date, reason }),
        },
      );
      toast.success(`Jurnal pembalik ${reversal.number} dibuat.`);
      setReverseOpen(false);
      router.push(`/accounting/journals/${reversal.id}`);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal membalik jurnal.");
    } finally {
      setPending(false);
    }
  }

  if (!canPost) return null;

  return (
    <>
      {status === "DRAFT" ? (
        <Button onClick={() => setPostOpen(true)}>
          <CheckCircle2 data-icon="inline-start" />
          Posting Jurnal
        </Button>
      ) : null}
      {status === "POSTED" ? (
        <Button variant="outline" onClick={() => setReverseOpen(true)}>
          <RotateCcw data-icon="inline-start" />
          Balik Jurnal
        </Button>
      ) : null}

      <AlertDialog open={postOpen} onOpenChange={setPostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Posting jurnal {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Jurnal yang sudah diposting tidak dapat diubah. Koreksi hanya dapat dilakukan dengan
              membuat jurnal pembalik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
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

      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Balik jurnal {number}</DialogTitle>
            <DialogDescription>
              Jurnal pembalik akan dibuat dengan debit dan kredit tertukar. Jurnal asli tetap
              tersimpan untuk jejak audit.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="reverse-date">Tanggal pembalik</FieldLabel>
              <Input
                id="reverse-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="reverse-reason">Alasan</FieldLabel>
              <Textarea
                id="reverse-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Contoh: kesalahan akun pada jurnal asli."
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReverseOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || reason.trim().length < 3 || !date}
              onClick={() => void reverse()}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Buat Pembalik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
