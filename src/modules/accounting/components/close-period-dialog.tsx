"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, requestJson } from "@/lib/api/client";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function ClosePeriodDialog() {
  const router = useRouter();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/v1/accounting/periods", {
        method: "POST",
        body: JSON.stringify({ year, month }),
      });
      toast.success(`Periode ${MONTHS[month - 1]} ${year} ditutup.`);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Gagal menutup periode.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Lock data-icon="inline-start" />
        Tutup Periode
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tutup Periode Akuntansi</DialogTitle>
            <DialogDescription>
              Periode yang ditutup tidak dapat menerima jurnal baru. Pastikan seluruh jurnal pada
              periode ini sudah diposting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="close-month">Bulan</FieldLabel>
              <Select
                value={String(month)}
                onValueChange={(next) => setMonth(Number(next ?? "1"))}
                items={MONTHS.map((label, index) => ({
                  value: String(index + 1),
                  label,
                }))}
              >
                <SelectTrigger id="close-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MONTHS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={Boolean(error) || undefined}>
              <FieldLabel htmlFor="close-year">Tahun</FieldLabel>
              <Input
                id="close-year"
                type="number"
                min={2000}
                max={2100}
                className="font-mono"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={() => void submit()} disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Tutup Periode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
