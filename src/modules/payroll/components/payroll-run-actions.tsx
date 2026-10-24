"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Wallet } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatIdr } from "@/lib/utils/currency";

type AccountOption = { id: string; code: string; name: string };

type PayrollRunActionsProps = {
  runId: string;
  number: string;
  status: string;
  totalNet: string;
  accounts: AccountOption[];
  canApprove: boolean;
  canPay: boolean;
  canCancel: boolean;
};

export function PayrollRunActions({
  runId,
  number,
  status,
  totalNet,
  accounts,
  canApprove,
  canPay,
  canCancel,
}: PayrollRunActionsProps) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  async function approve() {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/v1/payroll/runs/${runId}/approve`, { method: "POST" });
      toast.success(`Payroll ${number} disetujui dan jurnal telah diposting.`);
      setApproveOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal menyetujui payroll.");
    } finally {
      setPending(false);
    }
  }

  async function pay() {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/v1/payroll/runs/${runId}/pay`, {
        method: "POST",
        body: JSON.stringify({ accountId, date }),
      });
      toast.success(`Pembayaran payroll ${number} berhasil dicatat.`);
      setPayOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal membayar payroll.");
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/v1/payroll/runs/${runId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast.success(`Payroll ${number} dibatalkan.`);
      setCancelOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal membatalkan payroll.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && canApprove ? (
        <Button onClick={() => setApproveOpen(true)}>
          <CheckCircle2 data-icon="inline-start" />
          Setujui
        </Button>
      ) : null}
      {status === "APPROVED" && canPay ? (
        <Button onClick={() => setPayOpen(true)} disabled={accounts.length === 0}>
          <Wallet data-icon="inline-start" />
          Bayar
        </Button>
      ) : null}
      {status === "DRAFT" && canCancel ? (
        <Button variant="outline" onClick={() => setCancelOpen(true)}>
          <Ban data-icon="inline-start" />
          Batalkan
        </Button>
      ) : null}

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui payroll {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Payroll yang disetujui akan dikunci dan jurnal beban gaji sebesar{" "}
              <span className="font-mono">{formatIdr(totalNet)}</span> neto akan diposting ke
              akuntansi. Pastikan data absensi, cuti, dan komponen gaji sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void approve();
              }}
              disabled={pending}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Setujui &amp; Posting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bayar payroll {number}</DialogTitle>
            <DialogDescription>
              Pembayaran dicatat sebesar <span className="font-mono">{formatIdr(totalNet)}</span>{" "}
              dari akun kas/bank yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="payroll-pay-account">Akun kas/bank</FieldLabel>
              <Select
                value={accountId || null}
                onValueChange={(next) => setAccountId(next ?? "")}
                items={accounts.map((account) => ({
                  value: account.id,
                  label: `${account.code} — ${account.name}`,
                }))}
              >
                <SelectTrigger id="payroll-pay-account" className="w-full">
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} — {account.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="payroll-pay-date">Tanggal pembayaran</FieldLabel>
              <Input
                id="payroll-pay-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={() => void pay()} disabled={pending || !accountId}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Catat Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan payroll {number}?</DialogTitle>
            <DialogDescription>
              Payroll draf akan dibatalkan dan tidak dapat dipakai lagi. Tindakan ini tidak
              memengaruhi akuntansi karena jurnal belum diposting.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="payroll-cancel-reason">Alasan pembatalan</FieldLabel>
            <Textarea
              id="payroll-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: koreksi periode atau data absensi."
              rows={3}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Tidak
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void cancel()}
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Batalkan Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
