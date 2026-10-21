import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateSupplierButton } from "@/modules/master/supplier/components/supplier-form-dialog";
import { SuppliersTable } from "@/modules/master/supplier/components/suppliers-table";
import { listSuppliersQuerySchema } from "@/modules/master/supplier/schemas";
import { listSuppliers } from "@/modules/master/supplier/service";

export const metadata: Metadata = { title: "Supplier" };

type SuppliersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function SuppliersPage({ searchParams }: SuppliersPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Supplier" description="Master data supplier bahan & aksesori." />
      <Suspense fallback={<SuppliersSectionSkeleton />}>
        <SuppliersSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SuppliersSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
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

async function SuppliersSection({ searchParams }: SuppliersPageProps) {
  const actor = await requirePagePermission("master.supplier.view");
  const params = await searchParams;

  const parsed = listSuppliersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listSuppliersQuerySchema.parse({});

  const { items, total } = await listSuppliers(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.supplier.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode, nama, atau kontak..."
          ariaLabel="Cari supplier"
          status={listParams.status}
        />
        {canWrite ? <CreateSupplierButton /> : null}
      </div>
      <SuppliersTable suppliers={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} supplier terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
