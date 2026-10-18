"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatQty } from "@/lib/utils/currency";
import { createProductionOrderSchema, type CreateProductionOrderInput } from "../schemas";
import type { MaterialPlanningRow, ProducibleSoItemOption, ProductionOrder } from "../service";

type PlanningPreview = {
  bomId: string;
  bomVersion: number;
  rows: MaterialPlanningRow[];
  shortageCount: number;
  hasShortage: boolean;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; preview: PlanningPreview };

type SpkFormProps = {
  soItems: ProducibleSoItemOption[];
  lines: { id: string; code: string; name: string }[];
  defaults: { plannedStartDate: string; plannedEndDate: string };
};

/**
 * Form buat SPK + gate ketersediaan material (PRD FR-07/FR-08).
 * Ketersediaan diperiksa on-demand (pilih item/kuantitas/tanggal → periksa);
 * bila kurang, supervisor wajib mengisi alasan tetap dijalankan — validasi
 * yang sama juga ditegakkan service saat submit.
 */
export function SpkForm({ soItems, lines, defaults }: SpkFormProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });

  const form = useForm<CreateProductionOrderInput>({
    resolver: zodResolver(createProductionOrderSchema),
    defaultValues: {
      salesOrderItemId: "",
      plannedQuantity: 1,
      productionLineId: "",
      plannedStartDate: defaults.plannedStartDate,
      plannedEndDate: defaults.plannedEndDate,
      shortageReason: "",
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const soItemId = useWatch({ control: form.control, name: "salesOrderItemId" });
  const plannedQuantity = useWatch({ control: form.control, name: "plannedQuantity" });
  const shortageReason = useWatch({ control: form.control, name: "shortageReason" });
  const selected = soItems.find((item) => item.salesOrderItemId === soItemId) ?? null;

  const soItemOptions = soItems.map((item) => ({
    value: item.salesOrderItemId,
    label: `${item.salesOrderNumber} — ${item.productName} ${item.size}/${item.color} (${item.variantSku}) · sisa ${item.remainingQuantity}`,
  }));
  const lineOptions = lines.map((line) => ({
    value: line.id,
    label: `${line.name} (${line.code})`,
  }));

  async function checkAvailability() {
    const itemId = form.getValues("salesOrderItemId");
    const quantity = form.getValues("plannedQuantity");
    const needBy = form.getValues("plannedEndDate");
    if (!itemId || !quantity || quantity < 1) {
      setPreview({ status: "idle" });
      return;
    }
    setPreview({ status: "loading" });
    try {
      const params = new URLSearchParams({ soItem: itemId, quantity: String(quantity) });
      if (needBy) params.set("needBy", needBy);
      const data = await requestJson<PlanningPreview>(
        `/api/v1/production/planning?${params.toString()}`,
      );
      setPreview({ status: "done", preview: data });
    } catch (error) {
      setPreview({
        status: "error",
        message:
          error instanceof ApiRequestError ? error.message : "Gagal memeriksa ketersediaan.",
      });
    }
  }

  function handleItemChange(next: string, onChange: (value: string) => void) {
    onChange(next);
    const option = soItems.find((item) => item.salesOrderItemId === next);
    if (option) {
      form.setValue("plannedQuantity", option.remainingQuantity, { shouldValidate: true });
    }
    void checkAvailability();
  }

  const shortageNeedsReason =
    preview.status === "done" && preview.preview.hasShortage && !(shortageReason ?? "").trim();

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await requestJson<ProductionOrder>(`/api/v1/production-orders`, {
        method: "POST",
        body: JSON.stringify({ ...values, shortageReason: values.shortageReason ?? "" }),
      });
      toast.success(`SPK ${created.number} dibuat.`);
      router.push(`/production/${created.id}`);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError ? error.message : "Gagal membuat SPK. Coba lagi.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
          Informasi SPK
        </h2>
        <div className="grid gap-3 sm:grid-cols-12">
          <Field
            className="sm:col-span-8"
            data-invalid={Boolean(errors.salesOrderItemId) || undefined}
          >
            <FieldLabel htmlFor="spk-so-item">Item sales order</FieldLabel>
            <Controller
              control={form.control}
              name="salesOrderItemId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => {
                    if (next) handleItemChange(next, field.onChange);
                  }}
                  items={soItemOptions}
                >
                  <SelectTrigger id="spk-so-item" className="w-full">
                    <SelectValue placeholder="Pilih item SO terkonfirmasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {soItemOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.salesOrderItemId ? (
              <FieldError>{errors.salesOrderItemId.message}</FieldError>
            ) : null}
          </Field>

          <Field
            className="sm:col-span-4"
            data-invalid={Boolean(errors.plannedQuantity) || undefined}
          >
            <FieldLabel htmlFor="spk-quantity">Target kuantitas</FieldLabel>
            <Input
              id="spk-quantity"
              type="number"
              min={1}
              step={1}
              className="nums font-mono"
              aria-invalid={Boolean(errors.plannedQuantity) || undefined}
              {...form.register("plannedQuantity", {
                setValueAs: (value) => (value === "" ? 0 : Number(value)),
              })}
              onBlur={() => void checkAvailability()}
            />
            {errors.plannedQuantity ? (
              <FieldError>{errors.plannedQuantity.message}</FieldError>
            ) : null}
            {selected ? (
              <p className="nums font-mono text-[11px] text-muted-foreground">
                Sisa belum direncanakan: {formatQty(selected.remainingQuantity)} · BOM v
                {selected.bomVersion}
              </p>
            ) : null}
          </Field>

          <Field
            className="sm:col-span-4"
            data-invalid={Boolean(errors.productionLineId) || undefined}
          >
            <FieldLabel htmlFor="spk-line">Lini produksi</FieldLabel>
            <Controller
              control={form.control}
              name="productionLineId"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(next) => field.onChange(next)}
                  items={lineOptions}
                >
                  <SelectTrigger id="spk-line" className="w-full">
                    <SelectValue placeholder="Pilih lini produksi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lineOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.productionLineId ? (
              <FieldError>{errors.productionLineId.message}</FieldError>
            ) : null}
          </Field>

          <Field
            className="sm:col-span-4"
            data-invalid={Boolean(errors.plannedStartDate) || undefined}
          >
            <FieldLabel htmlFor="spk-start-date">Tanggal mulai</FieldLabel>
            <Input
              id="spk-start-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.plannedStartDate) || undefined}
              {...form.register("plannedStartDate")}
            />
            {errors.plannedStartDate ? (
              <FieldError>{errors.plannedStartDate.message}</FieldError>
            ) : null}
          </Field>

          <Field
            className="sm:col-span-4"
            data-invalid={Boolean(errors.plannedEndDate) || undefined}
          >
            <FieldLabel htmlFor="spk-end-date">Tanggal selesai</FieldLabel>
            <Input
              id="spk-end-date"
              type="date"
              className="nums font-mono"
              aria-invalid={Boolean(errors.plannedEndDate) || undefined}
              {...form.register("plannedEndDate")}
              onBlur={() => void checkAvailability()}
            />
            {errors.plannedEndDate ? (
              <FieldError>{errors.plannedEndDate.message}</FieldError>
            ) : null}
          </Field>

          <Field className="sm:col-span-12" data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="spk-notes">Catatan</FieldLabel>
            <Textarea
              id="spk-notes"
              rows={2}
              placeholder="Opsional, mis. prioritas buyer atau instruksi khusus"
              aria-invalid={Boolean(errors.notes) || undefined}
              {...form.register("notes")}
            />
            {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            Ketersediaan Material
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selected || preview.status === "loading"}
            onClick={() => void checkAvailability()}
          >
            {preview.status === "loading" ? <Spinner data-icon="inline-start" /> : null}
            Periksa Ketersediaan
          </Button>
        </div>

        {preview.status === "idle" ? (
          <p className="text-[13px] text-muted-foreground">
            Pilih item SO dan isi target kuantitas, lalu periksa ketersediaan material sebelum
            membuat SPK.
          </p>
        ) : null}

        {preview.status === "error" ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
            {preview.message}
          </p>
        ) : null}

        {preview.status === "done" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {preview.preview.hasShortage ? (
                <>
                  <AlertTriangle className="size-4 text-warning" />
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    Material kurang ({preview.preview.shortageCount} item)
                  </Badge>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <Badge
                    variant="outline"
                    className="border-success/30 bg-success/10 text-success"
                  >
                    Material cukup
                  </Badge>
                </>
              )}
              <span className="nums font-mono text-[11px] text-muted-foreground">
                BOM v{preview.preview.bomVersion} · {plannedQuantity ?? 0} unit
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-24 text-right">Bruto</TableHead>
                    <TableHead className="w-28 text-right">Cadangan</TableHead>
                    <TableHead className="w-28 text-right">Tersedia</TableHead>
                    <TableHead className="w-28 text-right">Terjadwal</TableHead>
                    <TableHead className="w-28 text-right">Kekurangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.rows.map((row) => (
                    <TableRow key={row.materialId}>
                      <TableCell>
                        <span className="font-medium">{row.name}</span>
                        <span className="nums block font-mono text-[11px] text-muted-foreground">
                          {row.code} · {row.unitCode}
                        </span>
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(row.grossQuantity)}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                        {formatQty(row.allowanceQuantity)}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(row.availableQuantity)}
                      </TableCell>
                      <TableCell className="nums text-right font-mono text-sm">
                        {formatQty(row.scheduledQuantity)}
                      </TableCell>
                      <TableCell
                        className={
                          row.shortageQuantity > 0
                            ? "nums text-right font-mono text-sm font-medium text-destructive"
                            : "nums text-right font-mono text-sm text-muted-foreground"
                        }
                      >
                        {formatQty(row.shortageQuantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.preview.hasShortage ? (
              <Field data-invalid={shortageNeedsReason || undefined}>
                <FieldLabel htmlFor="spk-shortage-reason">
                  Alasan tetap dijalankan (wajib bila material kurang)
                </FieldLabel>
                <Textarea
                  id="spk-shortage-reason"
                  rows={2}
                  placeholder="mis. sisa kebutuhan akan ditutup PO masuk minggu ini"
                  aria-invalid={shortageNeedsReason || undefined}
                  {...form.register("shortageReason")}
                />
                {shortageNeedsReason ? (
                  <FieldError>
                    Isi alasan tetap dijalankan atau lengkapi stok material terlebih dahulu.
                  </FieldError>
                ) : null}
              </Field>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card p-4">
        <Button type="button" variant="outline" render={<Link href="/production" />}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting || shortageNeedsReason}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Buat SPK
        </Button>
      </section>
    </form>
  );
}
