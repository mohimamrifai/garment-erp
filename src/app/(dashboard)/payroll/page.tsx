import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getTodayDate } from "@/lib/utils/dates";
import { CreatePayrollDialog } from "@/modules/payroll/components/create-payroll-dialog";
import { PayrollRunsTable } from "@/modules/payroll/components/payroll-runs-table";
import { listPayrollRunsQuerySchema } from "@/modules/payroll/schemas";
import { listPayrollRuns } from "@/modules/payroll/service";
import { PAYROLL_STATUS_LABELS } from "@/modules/payroll/status";

export const metadata: Metadata = { title: "Payroll" };

type PayrollPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function PayrollPage({ searchParams }: PayrollPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payroll"
        description="Hitung gaji bulanan, BPJS, PPh 21, dan slip gaji karyawan."
      />
      <Suspense fallback={<PayrollSkeleton />}>
        <PayrollSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function PayrollSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function PayrollSection({ searchParams }: PayrollPageProps) {
  const actor = await requirePagePermission("payroll.view");
  const params = await searchParams;
  const parsed = listPayrollRunsQuerySchema.safeParse({
    status: params.status,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listPayrollRunsQuerySchema.parse({});
  const { items, total } = await listPayrollRuns(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor payroll..."
          ariaLabel="Cari payroll"
          status="all"
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: Object.entries(PAYROLL_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
              widthClass: "w-40",
              "aria-label": "Filter status payroll",
            },
          ]}
        />
        {can(actor.roles, "payroll.run") ? (
          <CreatePayrollDialog defaultPeriod={getTodayDate().slice(0, 7)} />
        ) : null}
      </div>

      <PayrollRunsTable runs={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} payroll ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
