import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateDepartmentButton } from "@/modules/master/department/components/department-form-dialog";
import { DepartmentsTable } from "@/modules/master/department/components/departments-table";
import { listDepartmentsQuerySchema } from "@/modules/master/department/schemas";
import { listDepartments } from "@/modules/master/department/service";

export const metadata: Metadata = { title: "Departemen" };

type DepartmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function DepartmentsPage({ searchParams }: DepartmentsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departemen"
        description="Master data departemen organisasi (PRD FR-03)."
      />
      <Suspense fallback={<DepartmentsSectionSkeleton />}>
        <DepartmentsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function DepartmentsSectionSkeleton() {
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

async function DepartmentsSection({ searchParams }: DepartmentsPageProps) {
  const actor = await requirePagePermission("master.organization.view");
  const params = await searchParams;

  const parsed = listDepartmentsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listDepartmentsQuerySchema.parse({});

  const { items, total } = await listDepartments(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.organization.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama departemen..."
          ariaLabel="Cari departemen"
          status={listParams.status}
        />
        {canWrite ? <CreateDepartmentButton /> : null}
      </div>
      <DepartmentsTable departments={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} departemen terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
