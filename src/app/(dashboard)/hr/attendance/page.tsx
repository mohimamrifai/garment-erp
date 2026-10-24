import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getTodayDate } from "@/lib/utils/dates";
import { AttendanceFilters } from "@/modules/hr/components/attendance-filters";
import { AttendanceTable } from "@/modules/hr/components/attendance-table";
import { CreateAttendanceButton } from "@/modules/hr/components/create-attendance-button";
import { listAttendanceQuerySchema } from "@/modules/hr/schemas";
import { listAttendance, listEmployeeOptions } from "@/modules/hr/service";

export const metadata: Metadata = { title: "Absensi" };

type AttendancePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AttendancePage({ searchParams }: AttendancePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Absensi"
        description="Catat kehadiran, keterlambatan, dan lembur karyawan untuk perhitungan payroll."
      />
      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function AttendanceSection({ searchParams }: AttendancePageProps) {
  const actor = await requirePagePermission("hr.attendance.view");
  const params = await searchParams;
  const parsed = listAttendanceQuerySchema.safeParse({
    month: params.month,
    employeeId: params.employeeId,
    status: params.status,
    page: params.page,
  });
  const listParams = parsed.success
    ? parsed.data
    : listAttendanceQuerySchema.parse({ month: getTodayDate().slice(0, 7) });
  const [{ items, total }, employees] = await Promise.all([
    listAttendance(listParams),
    listEmployeeOptions(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AttendanceFilters
          month={listParams.month ?? getTodayDate().slice(0, 7)}
          employeeId={listParams.employeeId ?? ""}
          status={listParams.status}
          employees={employees}
        />
        {can(actor.roles, "hr.attendance.manage") ? (
          <CreateAttendanceButton employees={employees} />
        ) : null}
      </div>

      <AttendanceTable
        records={items}
        employees={employees}
        canManage={can(actor.roles, "hr.attendance.manage")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} absensi ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
