import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateMaterialButton } from "@/modules/master/material/components/material-form-dialog";
import { MaterialsTable } from "@/modules/master/material/components/materials-table";
import { listMaterialsQuerySchema } from "@/modules/master/material/schemas";
import { listMaterials } from "@/modules/master/material/service";
import { listUomOptions } from "@/modules/master/uom/service";

export const metadata: Metadata = { title: "Material" };

type MaterialsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MaterialsPage({ searchParams }: MaterialsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Material"
        description="Bahan baku & aksesori dengan stok minimum per gudang."
      />
      <Suspense fallback={<MaterialsSectionSkeleton />}>
        <MaterialsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function MaterialsSectionSkeleton() {
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

async function MaterialsSection({ searchParams }: MaterialsPageProps) {
  const actor = await requirePagePermission("master.material.view");
  const params = await searchParams;

  const parsed = listMaterialsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listMaterialsQuerySchema.parse({});

  const [{ items, total }, uoms] = await Promise.all([
    listMaterials(listParams),
    listUomOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.material.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama material..."
          ariaLabel="Cari material"
          status={listParams.status}
        />
        {canWrite ? <CreateMaterialButton uoms={uoms} /> : null}
      </div>
      <MaterialsTable materials={items} canWrite={canWrite} uoms={uoms} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} material terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
