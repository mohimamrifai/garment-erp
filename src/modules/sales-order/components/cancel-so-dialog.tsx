"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { cancelSalesOrderSchema, type CancelSalesOrderInput } from "../schemas";

type CancelSoDialogProps = {
  salesOrderId: string;
  number: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog pembatalan SO — wajib mengisi alasan (audit trail). */
export function CancelSoDialog({ salesOrderId, number, open, onOpenChange }: CancelSoDialogProps) {
  const router = useRouter();
  const form = useForm<CancelSalesOrderInput>({
    resolver: zodResolver(cancelSalesOrderSchema),
    defaultValues: { reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestJson(`/api/v1/sales-orders/${salesOrderId}/cancel`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Sales order ${number} dibatalkan.`);
      form.reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal membatalkan sales order.",
      });
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan {number}?</AlertDialogTitle>
          <AlertDialogDescription>
            Pembatalan tidak dapat dikembalikan. Pesanan yang sudah masuk produksi atau pengiriman
            tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <Field data-invalid={Boolean(errors.reason) || undefined}>
            <FieldLabel htmlFor="so-cancel-reason">Alasan pembatalan</FieldLabel>
            <Textarea
              id="so-cancel-reason"
              rows={3}
              placeholder="Mis. buyer mengubah spesifikasi pesanan"
              aria-invalid={Boolean(errors.reason) || undefined}
              {...form.register("reason")}
            />
            {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Batal</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Batalkan Pesanan
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
