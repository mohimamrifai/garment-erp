"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/db/schema";
import type { OutstandingInvoice } from "../service";
import { PaymentFormDialog } from "./payment-form-dialog";

export function CreatePaymentButton({
  accounts,
  invoices,
  bills,
}: {
  accounts: Account[];
  invoices: OutstandingInvoice[];
  bills: OutstandingInvoice[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <Plus data-icon="inline-start" />
        Catat Kas/Bank
      </Button>
      <PaymentFormDialog
        accounts={accounts}
        invoices={invoices}
        bills={bills}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
