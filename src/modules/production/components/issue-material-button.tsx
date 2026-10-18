"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocationOption } from "@/modules/master/warehouse/service";
import {
  MaterialIssueDialog,
  type MaterialIssueSuggestion,
} from "./material-issue-dialog";

type IssueMaterialButtonProps = {
  endpoint: string;
  orderNumber: string;
  locations: LocationOption[];
  suggestions: MaterialIssueSuggestion[];
  defaultIssuedAt: string;
};

/**
 * Tombol + dialog pemakaian material. `clientKey` (idempotency) dibuat sekali
 * per pembukaan dialog di induk, jadi klik ulang aman dari penggandaan.
 */
export function IssueMaterialButton({
  endpoint,
  orderNumber,
  locations,
  suggestions,
  defaultIssuedAt,
}: IssueMaterialButtonProps) {
  const [open, setOpen] = useState(false);
  const [clientKey, setClientKey] = useState("");

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setClientKey(crypto.randomUUID());
          setOpen(true);
        }}
      >
        Catat Pemakaian
      </Button>
      {open ? (
        <MaterialIssueDialog
          key={clientKey}
          open={open}
          onOpenChange={setOpen}
          endpoint={endpoint}
          clientKey={clientKey}
          orderNumber={orderNumber}
          locations={locations}
          suggestions={suggestions}
          defaultIssuedAt={defaultIssuedAt}
        />
      ) : null}
    </>
  );
}
