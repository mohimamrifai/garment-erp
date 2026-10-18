import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { BuyerSearch } from "@/modules/buyer/components/buyer-search";
import { CreateBuyerButton } from "@/modules/buyer/components/buyer-form-dialog";
import { BuyersTable } from "@/modules/buyer/components/buyers-table";
import { listBuyersQuerySchema } from "@/modules/buyer/schemas";
import { listBuyers } from "@/modules/buyer/service";

export const metadata: Metadata = { title: "Buyer" };

type BuyersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function BuyersPage({ searchParams }: BuyersPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buyer"
        description="Master data buyer (pelanggan) — pola referensi modul lain."
      />
      <Suspense fallback={<BuyersSectionSkeleton />}>
        <BuyersSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BuyersSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function BuyersSection({ searchParams }: BuyersPageProps) {
  const actor = await requirePagePermission("buyer.view");
  const params = await searchParams;

  const parsed = listBuyersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listBuyersQuerySchema.parse({});

  const { items, total } = await listBuyers(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));
  const canWrite = can(actor.roles, "buyer.create");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BuyerSearch status={listParams.status} />
        {canWrite ? <CreateBuyerButton /> : null}
      </div>
      <BuyersTable buyers={items} canWrite={canWrite} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{total} buyer terdaftar</p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
