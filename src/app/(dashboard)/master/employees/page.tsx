import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listDepartmentOptions } from "@/modules/master/department/service";
import { CreateEmployeeButton } from "@/modules/master/employee/components/employee-form-dialog";
import { EmployeesTable } from "@/modules/master/employee/components/employees-table";
import { listEmployeesQuerySchema } from "@/modules/master/employee/schemas";
import { listEmployees } from "@/modules/master/employee/service";

export const metadata: Metadata = { title: "Karyawan" };

type EmployeesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function EmployeesPage({ searchParams }: EmployeesPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Karyawan" description="Data karyawan untuk organisasi dan lini produksi." />
      <Suspense fallback={<EmployeesSectionSkeleton />}>
        <EmployeesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function EmployeesSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function EmployeesSection({ searchParams }: EmployeesPageProps) {
  const actor = await requirePagePermission("master.organization.view");
  const params = await searchParams;

  const parsed = listEmployeesQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    department: typeof params.department === "string" ? params.department : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listEmployeesQuerySchema.parse({});

  const [{ items, total }, departments] = await Promise.all([
    listEmployees(listParams),
    listDepartmentOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.organization.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode, nama, atau jabatan..."
          ariaLabel="Cari karyawan"
          status={listParams.status}
          filters={[
            {
              key: "department",
              value: listParams.department ?? "all",
              allLabel: "Semua departemen",
              options: departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
              widthClass: "w-48",
              "aria-label": "Filter departemen",
            },
          ]}
        />
        {canWrite ? <CreateEmployeeButton departments={departments} /> : null}
      </div>
      <EmployeesTable employees={items} canWrite={canWrite} departments={departments} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} karyawan terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
