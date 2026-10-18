"use client";

import { useState } from "react";
import { ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaterialOption } from "@/modules/master/material/service";
import type { VariantOption } from "@/modules/master/product/service";
import type { LocationOption } from "@/modules/master/warehouse/service";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { TransferStockDialog } from "./transfer-stock-dialog";

type StockActionsProps = {
  canMove: boolean;
  canAdjust: boolean;
  materials: MaterialOption[];
  variants: VariantOption[];
  locations: LocationOption[];
};

/** Kunci idempotensi per pembukaan dialog; remount dialog mereset isian form. */
function makeClientKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Tombol aksi stok pada halaman inventori (transfer & penyesuaian). */
export function StockActions({
  canMove,
  canAdjust,
  materials,
  variants,
  locations,
}: StockActionsProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferKey, setTransferKey] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustKey, setAdjustKey] = useState("");

  if (!canMove && !canAdjust) return null;

  return (
    <>
      {canMove ? (
        <Button
          variant="outline"
          onClick={() => {
            setTransferKey(makeClientKey());
            setTransferOpen(true);
          }}
        >
          <ArrowLeftRight data-icon="inline-start" />
          Transfer Stok
        </Button>
      ) : null}
      {canAdjust ? (
        <Button
          onClick={() => {
            setAdjustKey(makeClientKey());
            setAdjustOpen(true);
          }}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Penyesuaian Stok
        </Button>
      ) : null}

      {canMove ? (
        <TransferStockDialog
          key={transferKey}
          clientKey={transferKey}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          materials={materials}
          variants={variants}
          locations={locations}
        />
      ) : null}
      {canAdjust ? (
        <AdjustStockDialog
          key={adjustKey}
          clientKey={adjustKey}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          materials={materials}
          variants={variants}
          locations={locations}
        />
      ) : null}
    </>
  );
}
