"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
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
import { formatIdr } from "@/lib/utils/currency";
import { getTodayDate } from "@/lib/utils/dates";
import type { Account } from "@/lib/db/schema";
import {
  CASH_FLOW_CATEGORIES,
  CASH_FLOW_LABELS,
  journalFormSchema,
  type JournalFormInput,
} from "../schemas";

export function JournalFormDialog({
  accounts,
  open,
  onOpenChange,
}: {
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<JournalFormInput>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      date: getTodayDate(),
      description: "",
      cashFlowCategory: "OPERATING",
      lines: [
        { accountId: "", description: "", debit: 0, credit: 0 },
        { accountId: "", description: "", debit: 0, credit: 0 },
      ],
    },
  });
  const {
    control,
    formState: { errors, isSubmitting },
    register,
    watch,
    setError,
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines") ?? [];
  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  async function submit(values: JournalFormInput) {
    const debit = values.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = values.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    if (Math.abs(debit - credit) >= 0.005) {
      setError("root", { message: "Total debit dan kredit harus sama." });
      return;
    }
    try {
      const journal = await requestJson<{ id: string }>("/api/v1/accounting/journals", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Jurnal draf berhasil dibuat.");
      onOpenChange(false);
      router.push(`/accounting/journals/${journal.id}`);
    } catch (caught) {
      setError("root", {
        message: caught instanceof ApiRequestError ? caught.message : "Gagal membuat jurnal.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buat Jurnal Manual</DialogTitle>
          <DialogDescription>
            Jurnal disimpan sebagai draf terlebih dahulu. Setelah diposting, jurnal tidak dapat
            diubah dan hanya dapat dibalik.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.date) || undefined}>
              <FieldLabel htmlFor="journal-date">Tanggal</FieldLabel>
              <Input id="journal-date" type="date" {...register("date")} />
              {errors.date ? <FieldError>{errors.date.message}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.cashFlowCategory) || undefined}>
              <FieldLabel htmlFor="journal-cash-flow">Kategori arus kas</FieldLabel>
              <Controller
                control={control}
                name="cashFlowCategory"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(next) => field.onChange(next ?? "OPERATING")}
                    items={CASH_FLOW_CATEGORIES.map((value) => ({
                      value,
                      label: CASH_FLOW_LABELS[value],
                    }))}
                  >
                    <SelectTrigger id="journal-cash-flow" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CASH_FLOW_CATEGORIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {CASH_FLOW_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field className="sm:col-span-2" data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="journal-description">Keterangan</FieldLabel>
              <Input
                id="journal-description"
                placeholder="Contoh: penyesuaian biaya listrik bulan ini."
                {...register("description")}
              />
              {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Baris Jurnal
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ accountId: "", description: "", debit: 0, credit: 0 })}
              >
                <Plus data-icon="inline-start" />
                Tambah Baris
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-12">
                  <Field className="sm:col-span-4" data-invalid={Boolean(errors.lines?.[index]?.accountId) || undefined}>
                    <FieldLabel htmlFor={`journal-account-${index}`}>Akun</FieldLabel>
                    <Controller
                      control={control}
                      name={`lines.${index}.accountId`}
                      render={({ field: accountField }) => (
                        <Select
                          value={accountField.value || null}
                          onValueChange={(next) => accountField.onChange(next ?? "")}
                          items={accounts.map((account) => ({
                            value: account.id,
                            label: `${account.code} — ${account.name}`,
                          }))}
                        >
                          <SelectTrigger id={`journal-account-${index}`} className="w-full">
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
                    {errors.lines?.[index]?.accountId ? (
                      <FieldError>{errors.lines[index]?.accountId?.message}</FieldError>
                    ) : null}
                  </Field>
                  <Field className="sm:col-span-3">
                    <FieldLabel htmlFor={`journal-line-desc-${index}`}>Keterangan</FieldLabel>
                    <Input
                      id={`journal-line-desc-${index}`}
                      placeholder="Opsional"
                      {...register(`lines.${index}.description`)}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`journal-debit-${index}`}>Debit</FieldLabel>
                    <Input
                      id={`journal-debit-${index}`}
                      type="number"
                      min={0}
                      step="any"
                      className="text-right font-mono"
                      {...register(`lines.${index}.debit`, { valueAsNumber: true })}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`journal-credit-${index}`}>Kredit</FieldLabel>
                    <Input
                      id={`journal-credit-${index}`}
                      type="number"
                      min={0}
                      step="any"
                      className="text-right font-mono"
                      {...register(`lines.${index}.credit`, { valueAsNumber: true })}
                    />
                  </Field>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Hapus baris ${index + 1}`}
                      disabled={fields.length <= 2}
                      onClick={() => remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {errors.lines?.root?.message ? <FieldError>{errors.lines.root.message}</FieldError> : null}
            {typeof errors.lines?.message === "string" ? (
              <FieldError>{errors.lines.message}</FieldError>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-[12px]">
            <span className="text-muted-foreground">
              Total debit <span className="font-mono text-foreground">{formatIdr(totalDebit)}</span>{" "}
              · kredit{" "}
              <span className="font-mono text-foreground">{formatIdr(totalCredit)}</span>
            </span>
            <span className={balanced ? "text-success" : "text-destructive"}>
              {balanced ? "Seimbang" : "Belum seimbang"}
            </span>
          </div>

          {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || !balanced || accounts.length === 0}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Simpan Draf
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
