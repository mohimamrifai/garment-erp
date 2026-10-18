import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ActiveStatusBadge } from "@/components/master-data/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { can } from "@/lib/permissions";
import { formatDateTimeId } from "@/lib/utils/dates";
import { CreateVariantButton } from "@/modules/master/product/components/variant-form-dialog";
import { VariantsTable } from "@/modules/master/product/components/variants-table";
import { EditProductButton } from "@/modules/master/product/components/product-form-dialog";
import { getProductById, listVariants } from "@/modules/master/product/service";

export const metadata: Metadata = { title: "Detail Produk" };

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function ProductDetailSection({ params }: ProductDetailPageProps) {
  const actor = await requirePagePermission("master.product.view");
  const { id } = await params;

  let product;
  try {
    product = await getProductById(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const variants = await listVariants(product.id);
  const canWrite = can(actor.roles, "master.product.manage");

  return (
    <>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${variants.length} varian`}
        actions={
          canWrite ? (
            <>
              <EditProductButton product={product} />
              <CreateVariantButton productId={product.id} productSku={product.sku} />
            </>
          ) : null
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            SKU Produk
          </dt>
          <dd className="font-mono text-sm font-medium">{product.sku}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd>
            <ActiveStatusBadge isActive={product.isActive} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Dibuat
          </dt>
          <dd className="nums font-mono text-sm">{formatDateTimeId(product.createdAt)}</dd>
        </div>
        {product.description ? (
          <div className="flex flex-col gap-1 sm:col-span-3">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Deskripsi
            </dt>
            <dd className="text-sm">{product.description}</dd>
          </div>
        ) : null}
      </dl>

      <VariantsTable
        variants={variants}
        canWrite={canWrite}
        productId={product.id}
        productSku={product.sku}
      />
    </>
  );
}
