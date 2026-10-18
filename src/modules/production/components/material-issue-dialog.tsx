"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import type { LocationOption } from "@/modules/master/warehouse/service";
import { materialIssueDialogSchema, type MaterialIssueDialogInput } from "../schemas";

export type MaterialIssueSuggestion = {
  materialId: string;
  code: string;
  name: string;
  unitCode: string;
  /** Saran pemakaian = kebutuhan BOM × target − yang sudah dipakai. */
  suggestedQuantity: number;
};

type MaterialIssueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Endpoint POST pemakaian material, mis. `/api/v1/production-orders/{id}/issues`. */
  endpoint: string;
  /** Kunci anti penggandaan per pembukaan dialog (dari induk). */
  clientKey: string;
  orderNumber: string;
  locations: LocationOption[];
  suggestions: MaterialIssueSuggestion[];
  defaultIssuedAt: string;
};

/**
 * Dialog pemakaian material produksi: kuantitas disarankan dari BOM × target
 * dikurangi pemakaian sebelumnya, dapat disesuaikan dengan catatan. Stok
 * berkurang lewat inventory engine dalam satu transaksi.
 */
export function MaterialIssueDialog({
  open,
  onOpenChange,
  endpoint,
  clientKey,
  orderNumber,
  locations,
  suggestions,
  defaultIssuedAt,
}: MaterialIssueDialogProps) {
  const router = useRouter();

  const form = useForm<MaterialIssueDialogInput>({
    resolver: zodResolver(materialIssueDialogSchema),
    defaultValues: {
      locationId: "",
      issuedAt: defaultIssuedAt,
      notes: "",
      items: suggestions.map((suggestion) => ({
        materialId: suggestion.materialId,
        quantity: suggestion.suggestedQuantity,
        notes: "",
      })),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const itemsArray = useFieldArray({ control: form.control, name: "items" });

  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.warehouseName} — ${location.code} (${location.name})`,
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    const items = values.items
      .map((item, index) => ({
        materialId: item.materialId,
        quantity: item.quantity,
        notes: item.notes ?? "",
        suggestion: suggestions[index],
      }))
      .filter((item) => item.quantity > 0)
      .map(({ materialId, quantity, notes }) => ({ materialId, quantity, notes }));

    try {
      await requestJson(endpoint, {
        method: "POST",
        body: JSON.stringify({
          locationId: values.locationId,
          issuedAt: values.issuedAt,
          notes: values.notes ?? "",
          idempotencyKey: clientKey,
          items,
        }),
      });
      toast.success(`Pemakaian material untuk ${orderNumber} tercatat.`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiRequestError ? error.message : "Gagal mencatat pemakaian material.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catat Pemakaian Material</DialogTitle>
          <DialogDescription>
            {orderNumber} · isi kuantitas aktual yang diambil; saran dihitung dari BOM dikurangi
            pemakaian sebelumnya. Stok berkurang dari lokasi pengambilan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.locationId) || undefined}>
                <FieldLabel htmlFor="issue-location">Lokasi pengambilan</FieldLabel>
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      onValueChange={(next) => field.onChange(next)}
                      items={locationOptions}
                    >
                      <SelectTrigger id="issue-location" className="w-full">
                        <SelectValue placeholder="Pilih lokasi gudang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {locationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.locationId ? <FieldError>{errors.locationId.message}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.issuedAt) || undefined}>
                <FieldLabel htmlFor="issue-date">Tanggal pemakaian</FieldLabel>
                <Input
                  id="issue-date"
                  type="date"
                  className="nums font-mono"
                  aria-invalid={Boolean(errors.issuedAt) || undefined}
                  {...form.register("issuedAt")}
                />
                {errors.issuedAt ? <FieldError>{errors.issuedAt.message}</FieldError> : null}
              </Field>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-28 text-right">Saran</TableHead>
                    <TableHead className="w-36 text-right">Kuantitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsArray.fields.map((field, index) => {
                    const suggestion = suggestions[index];
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <span className="font-medium">{suggestion?.name}</span>
                          <span className="nums block font-mono text-[11px] text-muted-foreground">
                            {suggestion?.code} · {suggestion?.unitCode}
                          </span>
                        </TableCell>
                        <TableCell className="nums text-right font-mono text-sm text-muted-foreground">
                          {formatQty(suggestion?.suggestedQuantity ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            aria-label={`Kuantitas ${suggestion?.name ?? index + 1}`}
                            className="nums h-8 w-32 text-right font-mono"
                            {...form.register(`items.${index}.quantity`, {
                              setValueAs: (value) => (value === "" ? 0 : Number(value)),
                            })}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {typeof errors.items?.message === "string" ? (
              <p className="text-sm text-destructive">{errors.items.message}</p>
            ) : null}
            {typeof errors.items?.root?.message === "string" ? (
              <p className="text-sm text-destructive">{errors.items.root.message}</p>
            ) : null}

            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="issue-notes">Catatan / alasan penyesuaian</FieldLabel>
              <Textarea
                id="issue-notes"
                rows={2}
                placeholder="Opsional, mis. kuantitas aktual menyusut saat cutting"
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
              Catat Pemakaian
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
