"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Account } from "@/lib/db/schema";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  NORMAL_BALANCES,
  accountFormSchema,
  type AccountFormInput,
} from "../schemas";

export function AccountFormDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<AccountFormInput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      code: account?.code ?? "",
      name: account?.name ?? "",
      type: (account?.type as AccountFormInput["type"]) ?? "ASSET",
      normalBalance: (account?.normalBalance as AccountFormInput["normalBalance"]) ?? "DEBIT",
      parentId: account?.parentId ?? "",
      isCashBank: account?.isCashBank ?? false,
      bankName: account?.bankName ?? "",
      accountNumber: account?.accountNumber ?? "",
      description: account?.description ?? "",
    },
  });
  const {
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = form;
  const isCashBank = watch("isCashBank");

  useEffect(() => {
    if (!open) return;
    reset({
      code: account?.code ?? "",
      name: account?.name ?? "",
      type: (account?.type as AccountFormInput["type"]) ?? "ASSET",
      normalBalance: (account?.normalBalance as AccountFormInput["normalBalance"]) ?? "DEBIT",
      parentId: account?.parentId ?? "",
      isCashBank: account?.isCashBank ?? false,
      bankName: account?.bankName ?? "",
      accountNumber: account?.accountNumber ?? "",
      description: account?.description ?? "",
    });
  }, [open, account, reset]);

  async function submit(values: AccountFormInput) {
    try {
      const payload = {
        ...values,
        parentId: values.parentId || undefined,
        bankName: values.bankName || undefined,
        accountNumber: values.accountNumber || undefined,
        description: values.description || undefined,
      };
      if (account) {
        await requestJson(`/api/v1/accounting/accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Akun berhasil diperbarui.");
      } else {
        await requestJson("/api/v1/accounting/accounts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Akun berhasil dibuat.");
      }
      onOpenChange(false);
      router.refresh();
    } catch (caught) {
      form.setError("root", {
        message: caught instanceof ApiRequestError ? caught.message : "Gagal menyimpan akun.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Ubah Akun" : "Tambah Akun"}</DialogTitle>
          <DialogDescription>
            Akun mengikuti bagan akun SAK EMKM. Akun kas/bank harus bertipe aset dan dipakai untuk
            pembayaran.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.code) || undefined}>
              <FieldLabel htmlFor="account-code">Kode akun</FieldLabel>
              <Input
                id="account-code"
                className="font-mono"
                placeholder="1-1001"
                {...form.register("code")}
              />
              {errors.code ? <FieldError>{errors.code.message}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="account-name">Nama akun</FieldLabel>
              <Input id="account-name" placeholder="Kas Kecil" {...form.register("name")} />
              {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.type) || undefined}>
              <FieldLabel htmlFor="account-type">Tipe</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(next) => field.onChange(next ?? "ASSET")}
                    items={ACCOUNT_TYPES.map((type) => ({
                      value: type,
                      label: ACCOUNT_TYPE_LABELS[type],
                    }))}
                  >
                    <SelectTrigger id="account-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ACCOUNT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ACCOUNT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type ? <FieldError>{errors.type.message}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(errors.normalBalance) || undefined}>
              <FieldLabel htmlFor="account-normal">Saldo normal</FieldLabel>
              <Controller
                control={form.control}
                name="normalBalance"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(next) => field.onChange(next ?? "DEBIT")}
                    items={NORMAL_BALANCES.map((balance) => ({
                      value: balance,
                      label: balance === "DEBIT" ? "Debit" : "Kredit",
                    }))}
                  >
                    <SelectTrigger id="account-normal" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {NORMAL_BALANCES.map((balance) => (
                          <SelectItem key={balance} value={balance}>
                            {balance === "DEBIT" ? "Debit" : "Kredit"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.normalBalance ? (
                <FieldError>{errors.normalBalance.message}</FieldError>
              ) : null}
            </Field>

            <Field className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="isCashBank"
                  render={({ field }) => (
                    <Checkbox
                      id="account-cash-bank"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <FieldLabel htmlFor="account-cash-bank" className="font-normal">
                  Akun kas/bank
                </FieldLabel>
              </div>
            </Field>

            {isCashBank ? (
              <>
                <Field data-invalid={Boolean(errors.bankName) || undefined}>
                  <FieldLabel htmlFor="account-bank-name">Nama bank</FieldLabel>
                  <Input id="account-bank-name" placeholder="BCA" {...form.register("bankName")} />
                  {errors.bankName ? <FieldError>{errors.bankName.message}</FieldError> : null}
                </Field>
                <Field data-invalid={Boolean(errors.accountNumber) || undefined}>
                  <FieldLabel htmlFor="account-number">Nomor rekening</FieldLabel>
                  <Input
                    id="account-number"
                    className="font-mono"
                    placeholder="1234567890"
                    {...form.register("accountNumber")}
                  />
                  {errors.accountNumber ? (
                    <FieldError>{errors.accountNumber.message}</FieldError>
                  ) : null}
                </Field>
              </>
            ) : null}

            <Field className="sm:col-span-2" data-invalid={Boolean(errors.description) || undefined}>
              <FieldLabel htmlFor="account-description">Deskripsi</FieldLabel>
              <Textarea
                id="account-description"
                rows={2}
                placeholder="Opsional."
                {...form.register("description")}
              />
              {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
            </Field>
          </div>

          {errors.root?.message ? <FieldError>{errors.root.message}</FieldError> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {account ? "Simpan Perubahan" : "Tambah Akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
