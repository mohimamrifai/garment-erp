import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateLeaveButton } from "@/modules/hr/components/create-leave-button";
import { LeaveFilters } from "@/modules/hr/components/leave-filters";
import { LeaveTable } from "@/modules/hr/components/leave-table";
import { listLeaveQuerySchema } from "@/modules/hr/schemas";
import { listEmployeeOptions, listLeaveRequests, listLeaveTypes } from "@/modules/hr/service";

export const metadata: Metadata = { title: "Cuti" };

type LeavePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function LeavePage({ searchParams }: LeavePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cuti"
        description="Kelola pengajuan cuti karyawan dan pastikan potongan payroll sesuai kebijakan."
      />
      <Suspense fallback={<LeaveSkeleton />}>
        <LeaveSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function LeaveSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function LeaveSection({ searchParams }: LeavePageProps) {
  const actor = await requirePagePermission("hr.leave.view");
  const params = await searchParams;
  const parsed = listLeaveQuerySchema.safeParse({
    status: params.status,
    employeeId: params.employeeId,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listLeaveQuerySchema.parse({});
  const [{ items, total }, employees, leaveTypes] = await Promise.all([
    listLeaveRequests(listParams),
    listEmployeeOptions(),
    listLeaveTypes(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LeaveFilters
          employeeId={listParams.employeeId ?? ""}
          status={listParams.status}
          employees={employees}
        />
        {can(actor.roles, "hr.leave.request") ? (
          <CreateLeaveButton employees={employees} leaveTypes={leaveTypes} />
        ) : null}
      </div>

      <LeaveTable
        requests={items}
        canApprove={can(actor.roles, "hr.leave.approve")}
        canCancel={can(actor.roles, "hr.leave.approve")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} pengajuan cuti ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
