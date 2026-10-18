"use client";

import { useEffect } from "react";
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
import { cancelPurchaseOrderSchema, type CancelPurchaseOrderInput } from "../schemas";

type CancelDocumentDialogProps = {
  /** Endpoint POST pembatalan, mis. `/api/v1/purchase-orders/{id}/cancel`. */
  endpoint: string;
  /** Nomor dokumen untuk judul, mis. `PO-202610-0001`. */
  number: string;
  /** Kalimat penjelasan konsekuensi pembatalan. */
  description: string;
  /** Pesan sukses setelah pembatalan, mis. `Purchase order dibatalkan.` */
  successMessage: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog pembatalan dokumen purchasing — alasan wajib diisi (jejak audit).
 * Dipakai untuk purchase order dan penerimaan material.
 */
export function CancelDocumentDialog({
  endpoint,
  number,
  description,
  successMessage,
  open,
  onOpenChange,
}: CancelDocumentDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CancelPurchaseOrderInput>({
    resolver: zodResolver(cancelPurchaseOrderSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) reset({ reason: "" });
  }, [open, reset]);

  async function submit(input: CancelPurchaseOrderInput) {
    try {
      await requestJson(endpoint, { method: "POST", body: JSON.stringify(input) });
      toast.success(successMessage);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : "Gagal membatalkan dokumen.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan {number}?</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>

          <Field data-invalid={Boolean(errors.reason)}>
            <FieldLabel htmlFor="cancel-reason">Alasan</FieldLabel>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="mis. supplier tidak dapat memenuhi pesanan"
              aria-invalid={Boolean(errors.reason)}
              {...register("reason")}
            />
            {errors.reason ? <FieldError>{errors.reason.message}</FieldError> : null}
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Tidak jadi</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Batalkan
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
