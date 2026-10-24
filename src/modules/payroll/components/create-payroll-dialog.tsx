"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { ApiRequestError, requestJson } from "@/lib/api/client";

type PayrollRunResponse = { id: string; number: string };

export function CreatePayrollDialog({ defaultPeriod }: { defaultPeriod: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const run = await requestJson<PayrollRunResponse>("/api/v1/payroll/runs", {
        method: "POST",
        body: JSON.stringify({ period }),
      });
      toast.success(`Payroll ${run.number} berhasil dibuat.`);
      setOpen(false);
      router.push(`/payroll/${run.id}`);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal membuat payroll.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Buat Payroll
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Payroll Bulanan</DialogTitle>
            <DialogDescription>
              Payroll dihitung dari gaji karyawan aktif, absensi, dan cuti yang sudah disetujui.
              Hasilnya berstatus draf dan belum memengaruhi akuntansi.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="payroll-period">Periode</FieldLabel>
              <Input
                id="payroll-period"
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                required
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending || !period}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Buat Draf
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
