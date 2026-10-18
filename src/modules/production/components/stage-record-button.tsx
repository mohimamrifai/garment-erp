"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProductionStageCode } from "../status";
import { RecordOutputDialog } from "./record-output-dialog";

type StageRecordButtonProps = {
  endpoint: string;
  orderNumber: string;
  stageCode: ProductionStageCode;
  remainingNormal: number;
  remainingRework: number;
};

/**
 * Tombol + dialog catat output tahap. Dialog di-remount per pembukaan
 * (`key`) supaya nilai default selalu segar — pola aman untuk React Compiler.
 */
export function StageRecordButton({
  endpoint,
  orderNumber,
  stageCode,
  remainingNormal,
  remainingRework,
}: StageRecordButtonProps) {
  const [open, setOpen] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setInstanceKey((current) => current + 1);
          setOpen(true);
        }}
      >
        Catat Output
      </Button>
      {open ? (
        <RecordOutputDialog
          key={instanceKey}
          open={open}
          onOpenChange={setOpen}
          endpoint={endpoint}
          orderNumber={orderNumber}
          stageCode={stageCode}
          remainingNormal={remainingNormal}
          remainingRework={remainingRework}
        />
      ) : null}
    </>
  );
}
