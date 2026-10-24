import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreatePaymentButton } from "@/modules/accounting/components/create-payment-button";
import { PaymentFilters } from "@/modules/accounting/components/payment-filters";
import { PaymentsTable } from "@/modules/accounting/components/payments-table";
import { listPaymentsQuerySchema } from "@/modules/accounting/schemas";
import {
  listCashBankAccounts,
  listOutstandingBills,
  listOutstandingInvoices,
  listPayments,
} from "@/modules/accounting/service";

export const metadata: Metadata = { title: "Kas & Bank" };

type PaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PaymentsPage({ searchParams }: PaymentsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kas & Bank"
        description="Catat penerimaan dan pembayaran yang terhubung ke faktur, tagihan, dan payroll."
      />
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

async function PaymentsSection({ searchParams }: PaymentsPageProps) {
  const actor = await requirePagePermission("accounting.view");
  const params = await searchParams;
  const parsed = listPaymentsQuerySchema.safeParse({
    type: params.type,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listPaymentsQuerySchema.parse({});
  const canPay = can(actor.roles, "accounting.pay");
  const [{ items, total }, accounts, invoices, bills] = await Promise.all([
    listPayments(listParams),
    canPay ? listCashBankAccounts() : Promise.resolve([]),
    canPay ? listOutstandingInvoices() : Promise.resolve([]),
    canPay ? listOutstandingBills() : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PaymentFilters type={listParams.type} />
        {canPay ? (
          <CreatePaymentButton accounts={accounts} invoices={invoices} bills={bills} />
        ) : null}
      </div>

      <PaymentsTable payments={items} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} transaksi ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
