import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { can } from "@/lib/permissions";
import { formatDateId } from "@/lib/utils/dates";
import { BomEditorActions } from "@/modules/master/bom/components/bom-editor-actions";
import { BomItemForm } from "@/modules/master/bom/components/bom-item-form";
import { BomItemsTable } from "@/modules/master/bom/components/bom-items-table";
import { BomStatusBadge } from "@/modules/master/bom/components/bom-status-badge";
import { getBomDetail, listBomItems } from "@/modules/master/bom/service";
import { listMaterialOptions } from "@/modules/master/material/service";

export const metadata: Metadata = { title: "Editor BOM" };

type BomDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function BomDetailPage({ params }: BomDetailPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<BomDetailSkeleton />}>
        <BomDetailSection params={params} />
      </Suspense>
    </div>
  );
}

function BomDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-72" />
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function BomDetailSection({ params }: BomDetailPageProps) {
  const actor = await requirePagePermission("master.bom.view");
  const { id } = await params;

  let detail;
  try {
    detail = await getBomDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { bom, variant, product } = detail;
  const items = await listBomItems(bom.id);
  const canWrite = can(actor.roles, "master.bom.manage");
  const materials = canWrite && !bom.isActive ? await listMaterialOptions() : [];

  return (
    <>
      <PageHeader
        title={`${product.name} — ${variant.size}/${variant.color}`}
        description={`BOM v${bom.version} · ${variant.variantSku}`}
        actions={
          <>
            <Link
              href={`/master/products/${product.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Produk
            </Link>
            {canWrite ? (
              <BomEditorActions
                bomId={bom.id}
                version={bom.version}
                isActive={bom.isActive}
                itemCount={items.length}
              />
            ) : null}
          </>
        }
      />

      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd>
            <BomStatusBadge isActive={bom.isActive} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Versi
          </dt>
          <dd className="nums font-mono text-sm font-medium">v{bom.version}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Efektif dari
          </dt>
          <dd className="nums font-mono text-sm">{formatDateId(bom.effectiveFrom)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Efektif sampai
          </dt>
          <dd className="nums font-mono text-sm">
            {bom.effectiveUntil ? formatDateId(bom.effectiveUntil) : "—"}
          </dd>
        </div>
        {bom.notes ? (
          <div className="flex flex-col gap-1 sm:col-span-4">
            <dt className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Catatan
            </dt>
            <dd className="text-sm">{bom.notes}</dd>
          </div>
        ) : null}
      </dl>

      {bom.isActive ? (
        <p className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-[13px] text-muted-foreground">
          BOM aktif bersifat <span className="font-medium text-foreground">beku</span>. Untuk
          merevisi komposisi, gunakan <span className="font-medium text-foreground">Buat Versi Baru</span>{" "}
          — item versi ini disalin sebagai draf.
        </p>
      ) : canWrite ? (
        <BomItemForm bomId={bom.id} materials={materials} />
      ) : null}

      <BomItemsTable items={items} canWrite={canWrite} editable={!bom.isActive} />
    </>
  );
}
