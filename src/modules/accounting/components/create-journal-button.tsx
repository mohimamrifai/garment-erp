"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/db/schema";
import { JournalFormDialog } from "./journal-form-dialog";

export function CreateJournalButton({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <Plus data-icon="inline-start" />
        Buat Jurnal
      </Button>
      <JournalFormDialog accounts={accounts} open={open} onOpenChange={setOpen} />
    </>
  );
}
