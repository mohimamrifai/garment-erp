"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatQty } from "@/lib/utils/currency";
import { stageRecordDialogSchema, type StageRecordDialogInput } from "../schemas";
import { STAGE_CODE_LABELS, type ProductionStageCode } from "../status";

type RecordOutputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Endpoint POST catatan output, mis. `/api/v1/production-orders/{id}/records`. */
  endpoint: string;
  orderNumber: string;
  stageCode: ProductionStageCode;
  /** Sisa yang boleh diproses normal (hasil tahap sebelumnya). */
  remainingNormal: number;
  /** Sisa jatah rework dari inspeksi QC berstatus Rework. */
  remainingRework: number;
};

/**
 * Dialog catat output tahap: kuantitas diproses, cacat, dan (opsional) rework.
 * Kuantitas lolos dihitung otomatis = diproses − cacat; batas kuantitas
 * ditegakkan service (output tahap ≤ output tersedia tahap sebelumnya).
 */
export function RecordOutputDialog({
  open,
  onOpenChange,
  endpoint,
  orderNumber,
  stageCode,
  remainingNormal,
  remainingRework,
}: RecordOutputDialogProps) {
  const router = useRouter();

  const form = useForm<StageRecordDialogInput>({
    resolver: zodResolver(stageRecordDialogSchema),
    defaultValues: {
      processedQuantity: remainingNormal,
      rejectedQuantity: 0,
      isRework: false,
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const processed = useWatch({ control: form.control, name: "processedQuantity" });
  const rejected = useWatch({ control: form.control, name: "rejectedQuantity" });
  const isRework = useWatch({ control: form.control, name: "isRework" });
  const passed = Math.max(0, (Number(processed) || 0) - (Number(rejected) || 0));
  const limit = isRework ? remainingRework : remainingNormal;

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.processedQuantity > limit) {
      form.setError("root", {
        message: isRework
          ? `Sisa jatah rework tahap ini hanya ${limit} unit.`
          : `Tahap ini hanya dapat memproses maksimum ${limit} unit lagi.`,
      });
      return;
    }
    try {
      await requestJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          stageCode,
          processedQuantity: values.processedQuantity,
          passedQuantity: passed,
          rejectedQuantity: values.rejectedQuantity,
          isRework: values.isRework,
          notes: values.notes ?? "",
        }),
      });
      toast.success(
        `Output ${STAGE_CODE_LABELS[stageCode]} untuk ${orderNumber} dicatat (${passed} lolos).`,
      );
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal mencatat output.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat Output {STAGE_CODE_LABELS[stageCode]}</DialogTitle>
          <DialogDescription>
            {orderNumber} · sisa dapat diproses {formatQty(remainingNormal)} unit
            {remainingRework > 0 ? ` · jatah rework ${formatQty(remainingRework)} unit` : ""}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.processedQuantity) || undefined}>
                <FieldLabel htmlFor="stage-processed">Kuantitas diproses</FieldLabel>
                <Input
                  id="stage-processed"
                  type="number"
                  min={1}
                  step={1}
                  className="nums font-mono"
                  aria-invalid={Boolean(errors.processedQuantity) || undefined}
                  {...form.register("processedQuantity", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                />
                {errors.processedQuantity ? (
                  <FieldError>{errors.processedQuantity.message}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.rejectedQuantity) || undefined}>
                <FieldLabel htmlFor="stage-rejected">Kuantitas cacat</FieldLabel>
                <Input
                  id="stage-rejected"
                  type="number"
                  min={0}
                  step={1}
                  className="nums font-mono"
                  aria-invalid={Boolean(errors.rejectedQuantity) || undefined}
                  {...form.register("rejectedQuantity", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                />
                {errors.rejectedQuantity ? (
                  <FieldError>{errors.rejectedQuantity.message}</FieldError>
                ) : null}
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Kuantitas lolos
              </span>
              <span className="nums font-mono text-sm font-medium">{formatQty(passed)}</span>
            </div>

            <Controller
              control={form.control}
              name="isRework"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="stage-rework"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                      form.setValue(
                        "processedQuantity",
                        checked === true ? remainingRework : remainingNormal,
                        { shouldValidate: true },
                      );
                    }}
                  />
                  <FieldLabel htmlFor="stage-rework">
                    Hasil rework — memproses ulang barang cacat (jatah dari inspeksi QC Rework)
                  </FieldLabel>
                </Field>
              )}
            />

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="stage-notes">Catatan</FieldLabel>
              <Textarea
                id="stage-notes"
                rows={2}
                placeholder="Opsional, mis. operator atau kendala mesin"
                aria-invalid={Boolean(errors.notes) || undefined}
                {...form.register("notes")}
              />
              {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Catat Output
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
