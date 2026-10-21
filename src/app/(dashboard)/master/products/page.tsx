import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateProductButton } from "@/modules/master/product/components/product-form-dialog";
import { ProductsTable } from "@/modules/master/product/components/products-table";
import { listProductsQuerySchema } from "@/modules/master/product/schemas";
import { listProducts } from "@/modules/master/product/service";

export const metadata: Metadata = { title: "Produk" };

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ProductsPage({ searchParams }: ProductsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produk"
        description="Model pakaian dan varian ukuran/warna."
      />
      <Suspense fallback={<ProductsSectionSkeleton />}>
        <ProductsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ProductsSectionSkeleton() {
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

async function ProductsSection({ searchParams }: ProductsPageProps) {
  const actor = await requirePagePermission("master.product.view");
  const params = await searchParams;

  const parsed = listProductsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listProductsQuerySchema.parse({});

  const { items, total } = await listProducts(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "master.product.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari SKU atau nama produk..."
          ariaLabel="Cari produk"
          status={listParams.status}
        />
        {canWrite ? <CreateProductButton /> : null}
      </div>
      <ProductsTable products={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} produk terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
