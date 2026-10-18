import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateBomButton } from "@/modules/master/bom/components/bom-create-dialog";
import { BomsTable } from "@/modules/master/bom/components/boms-table";
import { listBomsQuerySchema } from "@/modules/master/bom/schemas";
import { listBoms } from "@/modules/master/bom/service";
import { listVariantOptions } from "@/modules/master/product/service";

export const metadata: Metadata = { title: "Bill of Materials" };

type BomPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function BomPage({ searchParams }: BomPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bill of Materials"
        description="Komposisi material per varian produk dengan versi dan aktivasi (PRD FR-07)."
      />
      <Suspense fallback={<BomSectionSkeleton />}>
        <BomSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BomSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function BomSection({ searchParams }: BomPageProps) {
  const actor = await requirePagePermission("master.bom.view");
  const params = await searchParams;

  const parsed = listBomsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    variant: typeof params.variant === "string" ? params.variant : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listBomsQuerySchema.parse({});

  const [{ items, total }, variants] = await Promise.all([
    listBoms(listParams),
    listVariantOptions(),
  ]);

  const variantFilterLabel = listParams.variant
    ? (variants.find((variant) => variant.id === listParams.variant)?.variantSku ?? null)
    : null;

  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.bom.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari produk atau SKU varian..."
          ariaLabel="Cari BOM"
          status={listParams.status}
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: [
                { value: "active", label: "Aktif" },
                { value: "draft", label: "Draf" },
              ],
              widthClass: "w-40",
              "aria-label": "Filter status BOM",
            },
          ]}
        />
        {canWrite ? <CreateBomButton variants={variants} /> : null}
      </div>

      {listParams.variant ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Menampilkan BOM untuk varian{" "}
            <span className="font-mono text-foreground">
              {variantFilterLabel ?? listParams.variant}
            </span>
            .
          </span>
          <Button variant="ghost" size="sm" render={<Link href="/master/bom" />}>
            <X data-icon="inline-start" />
            Tampilkan semua
          </Button>
        </div>
      ) : null}

      <BomsTable boms={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} versi BOM terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
