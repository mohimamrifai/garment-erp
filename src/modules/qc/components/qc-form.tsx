"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { formatQty } from "@/lib/utils/currency";
import {
  QC_RESULT_LABELS,
  STAGE_CODE_LABELS,
  type ProductionStageCode,
} from "@/modules/production/status";
import { createQcInspectionSchema, type CreateQcInspectionInput } from "../schemas";

export type QcStageOption = {
  stageId: string;
  stageCode: ProductionStageCode;
  productionOrderNumber: string;
  productName: string;
  variantSku: string;
  inspectableQuantity: number;
};

type QcParentInfo = {
  inspectionId: string;
  number: string;
  stageId: string;
  stageCode: ProductionStageCode;
  orderNumber: string;
  productName: string;
  variantSku: string;
  remainingQuantity: number;
};

type QcFormProps = {
  stageOptions: QcStageOption[];
  /** Mode inspeksi ulang: inspeksi induk + sisa jatah rework-nya. */
  parent: QcParentInfo | null;
};

const emptyDefect: CreateQcInspectionInput["defects"][number] = {
  defectCode: "",
  defectName: "",
  quantity: 1,
  disposition: "",
};

/**
 * Form inspeksi QC: pilih tahap (atau teknis rework dari inspeksi induk),
 * isi kuantitas diperiksa/lolos — cacat dihitung otomatis — dan rincian
 * cacat. Batas kuantitas ditegakkan service (output tersedia + jatah rework).
 */
export function QcForm({ stageOptions, parent }: QcFormProps) {
  const router = useRouter();
  const isFollowUp = parent !== null;

  const defaultStage = parent
    ? stageOptions.find((option) => option.stageId === parent.stageId) ?? null
    : null;
  const defaultInspected = parent
    ? parent.remainingQuantity
    : (defaultStage?.inspectableQuantity ?? 1);

  const form = useForm<CreateQcInspectionInput>({
    resolver: zodResolver(createQcInspectionSchema),
    defaultValues: {
      productionStageId: parent?.stageId ?? "",
      parentInspectionId: parent?.inspectionId ?? "",
      inspectedQuantity: defaultInspected,
      passedQuantity: defaultInspected,
      rejectedQuantity: 0,
      result: "PENDING",
      notes: "",
      defects: [],
    },
  });
  const { errors, isSubmitting } = form.formState;
  const defectsArray = useFieldArray({ control: form.control, name: "defects" });

  const stageId = useWatch({ control: form.control, name: "productionStageId" });
  const inspected = useWatch({ control: form.control, name: "inspectedQuantity" });
  const passed = useWatch({ control: form.control, name: "passedQuantity" });
  const result = useWatch({ control: form.control, name: "result" });
  const selectedStage = stageOptions.find((option) => option.stageId === stageId) ?? null;
  const rejected = Math.max(0, (Number(inspected) || 0) - (Number(passed) || 0));

  const cap = isFollowUp ? parent.remainingQuantity : (selectedStage?.inspectableQuantity ?? 0);

  const stageOptionsList = stageOptions.map((option) => ({
    value: option.stageId,
    label: `${option.productionOrderNumber} — ${option.productName} (${option.variantSku}) · ${STAGE_CODE_LABELS[option.stageCode]} · sisa ${option.inspectableQuantity}`,
  }));

  function handleStageChange(next: string, onChange: (value: string) => void) {
    onChange(next);
    const option = stageOptions.find((candidate) => candidate.stageId === next);
    if (option) {
      form.setValue("inspectedQuantity", option.inspectableQuantity, { shouldValidate: true });
      form.setValue("passedQuantity", option.inspectableQuantity, { shouldValidate: true });
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.inspectedQuantity > cap) {
      form.setError("root", {
        message: `Kuantitas diperiksa melebihi batas ${cap} unit.`,
      });
      return;
    }
    try {
      const created = await requestJson<{ id: string; number: string }>(
        `/api/v1/qc-inspections`,
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            parentInspectionId: values.parentInspectionId ?? "",
            notes: values.notes ?? "",
            rejectedQuantity: rejected,
          }),
        },
      );
      toast.success(`Inspeksi ${created.number} disimpan.`);
      router.push(`/qc/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiRequestError ? error.message : "Gagal menyimpan inspeksi.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Informasi Inspeksi
        </h2>

        {isFollowUp ? (
          <p className="rounded-md border bg-muted/30 p-3 text-[13px]">
            Inspeksi ulang dari <span className="nums font-mono">{parent.number}</span> —{" "}
            {parent.orderNumber} · {parent.productName} ({parent.variantSku}) ·{" "}
            {STAGE_CODE_LABELS[parent.stageCode]}. Sisa jatah rework:{" "}
            <span className="nums font-mono">{formatQty(parent.remainingQuantity)}</span> unit.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-12">
            <Field
              className="sm:col-span-8"
              data-invalid={Boolean(errors.productionStageId) || undefined}
            >
              <FieldLabel htmlFor="qc-stage">Tahap produksi</FieldLabel>
              <Controller
                control={form.control}
                name="productionStageId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(next) => {
                      if (next) handleStageChange(next, field.onChange);
                    }}
                    items={stageOptionsList}
                  >
                    <SelectTrigger id="qc-stage" className="w-full">
                      <SelectValue placeholder="Pilih tahap dengan output siap diperiksa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {stageOptionsList.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.productionStageId ? (
                <FieldError>{errors.productionStageId.message}</FieldError>
              ) : null}
              {selectedStage ? (
                <p className="nums font-mono text-[11px] text-muted-foreground">
                  Sisa dapat diperiksa: {formatQty(selectedStage.inspectableQuantity)} unit
                </p>
              ) : null}
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-12">
          <Field
            className="sm:col-span-3"
            data-invalid={Boolean(errors.inspectedQuantity) || undefined}
          >
            <FieldLabel htmlFor="qc-inspected">Diperiksa</FieldLabel>
            <Input
              id="qc-inspected"
              type="number"
              min={1}
              step={1}
              className="nums font-mono"
              aria-invalid={Boolean(errors.inspectedQuantity) || undefined}
              {...form.register("inspectedQuantity", {
                setValueAs: (value) => (value === "" ? 0 : Number(value)),
              })}
            />
            {errors.inspectedQuantity ? (
              <FieldError>{errors.inspectedQuantity.message}</FieldError>
            ) : null}
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.passedQuantity) || undefined}>
            <FieldLabel htmlFor="qc-passed">Lolos</FieldLabel>
            <Input
              id="qc-passed"
              type="number"
              min={0}
              step={1}
              className="nums font-mono"
              aria-invalid={Boolean(errors.passedQuantity) || undefined}
              {...form.register("passedQuantity", {
                setValueAs: (value) => (value === "" ? 0 : Number(value)),
              })}
            />
            {errors.passedQuantity ? (
              <FieldError>{errors.passedQuantity.message}</FieldError>
            ) : null}
          </Field>

          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="qc-rejected-display">Cacat (otomatis)</FieldLabel>
            <Input
              id="qc-rejected-display"
              value={rejected}
              readOnly
              disabled
              className="nums font-mono"
            />
          </Field>

          <Field className="sm:col-span-3" data-invalid={Boolean(errors.result) || undefined}>
            <FieldLabel htmlFor="qc-result">Hasil inspeksi</FieldLabel>
            <Controller
              control={form.control}
              name="result"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => field.onChange(next)}
                  items={(Object.keys(QC_RESULT_LABELS) as (keyof typeof QC_RESULT_LABELS)[]).map(
                    (value) => ({ value, label: QC_RESULT_LABELS[value] }),
                  )}
                >
                  <SelectTrigger id="qc-result" className="w-full">
                    <SelectValue placeholder="Pilih hasil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(Object.keys(QC_RESULT_LABELS) as (keyof typeof QC_RESULT_LABELS)[]).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {QC_RESULT_LABELS[value]}
                          </SelectItem>
                        ),
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.result ? <FieldError>{errors.result.message}</FieldError> : null}
            {result === "REWORK" ? (
              <p className="text-[11px] text-muted-foreground">
                Hasil Rework menambah jatah rework tahap ini; barang diproses ulang lewat catatan
                output bertanda rework.
              </p>
            ) : null}
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Rincian Cacat
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => defectsArray.append({ ...emptyDefect })}
          >
            <Plus data-icon="inline-start" />
            Tambah Cacat
          </Button>
        </div>

        {typeof errors.defects?.message === "string" ? (
          <p className="text-sm text-destructive">{errors.defects.message}</p>
        ) : null}
        {typeof errors.defects?.root?.message === "string" ? (
          <p className="text-sm text-destructive">{errors.defects.root.message}</p>
        ) : null}

        {defectsArray.fields.length === 0 ? (
          <p className="rounded-lg border p-4 text-[13px] text-muted-foreground">
            Belum ada rincian cacat. Total rincian tidak boleh melebihi kuantitas cacat.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {defectsArray.fields.map((field, index) => {
              const defectErrors = errors.defects?.[index];
              return (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-12"
                >
                  <Field
                    className="sm:col-span-3"
                    data-invalid={Boolean(defectErrors?.defectCode) || undefined}
                  >
                    <FieldLabel htmlFor={`qc-defect-code-${index}`}>Kode</FieldLabel>
                    <Input
                      id={`qc-defect-code-${index}`}
                      placeholder="mis. JHT-01"
                      aria-invalid={Boolean(defectErrors?.defectCode) || undefined}
                      {...form.register(`defects.${index}.defectCode`)}
                    />
                    {defectErrors?.defectCode ? (
                      <FieldError>{defectErrors.defectCode.message}</FieldError>
                    ) : null}
                  </Field>
                  <Field
                    className="sm:col-span-4"
                    data-invalid={Boolean(defectErrors?.defectName) || undefined}
                  >
                    <FieldLabel htmlFor={`qc-defect-name-${index}`}>Nama cacat</FieldLabel>
                    <Input
                      id={`qc-defect-name-${index}`}
                      placeholder="mis. jahitan loncat"
                      aria-invalid={Boolean(defectErrors?.defectName) || undefined}
                      {...form.register(`defects.${index}.defectName`)}
                    />
                    {defectErrors?.defectName ? (
                      <FieldError>{defectErrors.defectName.message}</FieldError>
                    ) : null}
                  </Field>
                  <Field
                    className="sm:col-span-2"
                    data-invalid={Boolean(defectErrors?.quantity) || undefined}
                  >
                    <FieldLabel htmlFor={`qc-defect-qty-${index}`}>Kuantitas</FieldLabel>
                    <Input
                      id={`qc-defect-qty-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      className="nums font-mono"
                      aria-invalid={Boolean(defectErrors?.quantity) || undefined}
                      {...form.register(`defects.${index}.quantity`, {
                        setValueAs: (value) => (value === "" ? 0 : Number(value)),
                      })}
                    />
                    {defectErrors?.quantity ? (
                      <FieldError>{defectErrors.quantity.message}</FieldError>
                    ) : null}
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`qc-defect-disposition-${index}`}>Tindakan</FieldLabel>
                    <Input
                      id={`qc-defect-disposition-${index}`}
                      placeholder="mis. rework"
                      {...form.register(`defects.${index}.disposition`)}
                    />
                  </Field>
                  <div className="flex items-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Hapus cacat ${index + 1}`}
                      onClick={() => defectsArray.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <FieldGroup>
          <Field data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="qc-notes">Catatan inspeksi</FieldLabel>
            <Textarea
              id="qc-notes"
              rows={2}
              placeholder="Opsional, mis. temuan umum atau instruksi perbaikan"
              aria-invalid={Boolean(errors.notes) || undefined}
              {...form.register("notes")}
            />
            {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
          </Field>
        </FieldGroup>
      </section>

      <section className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-4">
        <Button
          type="button"
          variant="outline"
          render={<Link href={isFollowUp ? `/qc/${parent.inspectionId}` : "/qc"} />}
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Simpan Inspeksi
        </Button>
      </section>
    </form>
  );
}
