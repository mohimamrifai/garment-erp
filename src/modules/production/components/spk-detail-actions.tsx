"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CancelDocumentDialog } from "@/modules/purchasing/components/cancel-document-dialog";

type SpkDetailActionsProps = {
  productionOrderId: string;
  number: string;
  canCancel: boolean;
};

/** Aksi halaman detail SPK: pembatalan SPK (hanya bila belum ada catatan). */
export function SpkDetailActions({
  productionOrderId,
  number,
  canCancel,
}: SpkDetailActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!canCancel) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
        <Ban data-icon="inline-start" />
        Batalkan
      </Button>
      <CancelDocumentDialog
        endpoint={`/api/v1/production-orders/${productionOrderId}/cancel`}
        number={number}
        description="SPK yang dibatalkan tidak dapat dicatat lagi. Hanya SPK tanpa catatan produksi yang dapat dibatalkan."
        successMessage="SPK dibatalkan."
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}
