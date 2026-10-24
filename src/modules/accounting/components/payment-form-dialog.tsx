"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatIdr } from "@/lib/utils/currency";
import { formatDateId, getTodayDate } from "@/lib/utils/dates";
import type { Account } from "@/lib/db/schema";
import type { OutstandingInvoice } from "../service";
import { paymentFormSchema, type PaymentFormInput } from "../schemas";

export function PaymentFormDialog({
  accounts,
  invoices,
  bills,
  open,
  onOpenChange,
}: {
  accounts: Account[];
  invoices: OutstandingInvoice[];
  bills: OutstandingInvoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      type: "RECEIPT",
      date: getTodayDate(),
      amount: 0,
      accountId: accounts[0]?.id ?? "",
      referenceType: "SALES_INVOICE",
      referenceId: "",
      notes: "",
    },
  });
  const {
    control,
    formState: { errors, isSubmitting },
    register,
    watch,
    setValue,
    setError,
  } = form;
  const type = watch("type");
  const referenceId = watch("referenceId");
  const referenceOptions = type === "RECEIPT" ? invoices : bills;
  const selected = referenceOptions.find((option) => option.id === referenceId);

  function changeType(next: "RECEIPT" | "PAYMENT") {
    setValue("type", next);
    setValue("referenceType", next === "RECEIPT" ? "SALES_INVOICE" : "PURCHASE_BILL");
    setValue("referenceId", "");
    setValue("amount", 0);
  }

  async function submit(values: PaymentFormInput) {
    try {
      await requestJson("/api/v1/accounting/payments", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Pembayaran berhasil dicatat dan jurnal telah diposting.");
      onOpenChange(false);
      router.refresh();
    } catch (caught) {
      setError("root", {
        message: caught instanceof ApiRequestError ? caught.message : "Gagal mencatat pembayaran.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat Kas &amp; Bank</DialogTitle>
          <DialogDescription>
            Penerimaan mengurangi piutang, pembayaran mengurangi utang. Jurnal dibuat otomatis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.type) || undefined}>
              <FieldLabel htmlFor="payment-type">Jenis</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(next) => changeType((next as "RECEIPT" | "PAYMENT") ?? "RECEIPT")}
                    items={[
                      { value: "RECEIPT", label: "Penerimaan" },
                      { value: "PAYMENT", label: "Pembayaran" },
                    ]}
                  >
                    <SelectTrigger id="payment-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="RECEIPT">Penerimaan</SelectItem>
                        <SelectItem value="PAYMENT">Pembayaran</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={Boolean(errors.date) || undefined}>
              <FieldLabel htmlFor="payment-date">Tanggal</FieldLabel>
              <Input id="payment-date" type="date" {...register("date")} />
              {errors.date ? <FieldError>{errors.date.message}</FieldError> : null}
            </Field>

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.referenceId) || undefined}>
              <FieldLabel htmlFor="payment-reference">
                {type === "RECEIPT" ? "Faktur penjualan" : "Tagihan pembelian"}
              </FieldLabel>
              <Controller
                control={control}
                name="referenceId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => {
                      field.onChange(next ?? "");
                      const option = referenceOptions.find((item) => item.id === next);
                      if (option) setValue("amount", Number(option.outstanding));
                    }}
                    items={referenceOptions.map((option) => ({
                      value: option.id,
                      label: `${option.number} — ${option.partyName} (${formatIdr(option.outstanding)})`,
                    }))}
                  >
                    <SelectTrigger id="payment-reference" className="w-full">
                      <SelectValue placeholder="Pilih dokumen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {referenceOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.number} — {option.partyName} ({formatIdr(option.outstanding)})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.referenceId ? <FieldError>{errors.referenceId.message}</FieldError> : null}
              {selected ? (
                <p className="text-[11px] text-muted-foreground">
                  Jatuh tempo {formatDateId(selected.dueDate)} · sisa{" "}
                  <span className="font-mono">{formatIdr(selected.outstanding)}</span>
                </p>
              ) : null}
            </Field>

            <Field data-invalid={Boolean(errors.amount) || undefined}>
              <FieldLabel htmlFor="payment-amount">Jumlah</FieldLabel>
              <Input
                id="payment-amount"
                type="number"
                min={0}
                step="any"
                className="text-right font-mono"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount ? <FieldError>{errors.amount.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.accountId) || undefined}>
              <FieldLabel htmlFor="payment-account">Akun kas/bank</FieldLabel>
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next ?? "")}
                    items={accounts.map((account) => ({
                      value: account.id,
                      label: `${account.code} — ${account.name}`,
                    }))}
                  >
                    <SelectTrigger id="payment-account" className="w-full">
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
                )}
              />
              {errors.accountId ? <FieldError>{errors.accountId.message}</FieldError> : null}
            </Field>

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="payment-notes">Catatan</FieldLabel>
              <Textarea
                id="payment-notes"
                rows={2}
                placeholder="Opsional, mis. nomor transfer."
                {...register("notes")}
              />
              {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
            </Field>
          </div>

          {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || !selected || accounts.length === 0}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Catat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
