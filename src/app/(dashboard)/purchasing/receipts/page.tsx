import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { ReceiptsTable } from "@/modules/purchasing/components/receipts-table";
import { listMaterialReceiptsQuerySchema } from "@/modules/purchasing/schemas";
import { listMaterialReceipts } from "@/modules/purchasing/service";
import { RECEIPT_STATUS_LABELS } from "@/modules/purchasing/status";

export const metadata: Metadata = { title: "Penerimaan Material" };

type ReceiptsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Penerimaan Material"
        description="Penerimaan barang dari purchase order — stok bertambah setelah diposting."
      />
      <Suspense fallback={<ReceiptsSectionSkeleton />}>
        <ReceiptsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ReceiptsSectionSkeleton() {
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

async function ReceiptsSection({ searchParams }: ReceiptsPageProps) {
  const actor = await requirePagePermission("receipt.view");
  const params = await searchParams;

  const parsed = listMaterialReceiptsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    status: params.status,
    po: typeof params.po === "string" ? params.po : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listMaterialReceiptsQuerySchema.parse({});

  const { items, total } = await listMaterialReceipts(listParams);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  const statusOptions = (
    Object.keys(RECEIPT_STATUS_LABELS) as (keyof typeof RECEIPT_STATUS_LABELS)[]
  ).map((status) => ({ value: status, label: RECEIPT_STATUS_LABELS[status] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor RCV, PO, atau supplier..."
          ariaLabel="Cari penerimaan material"
          status={listParams.status}
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: statusOptions,
              widthClass: "w-40",
              "aria-label": "Filter status penerimaan",
            },
          ]}
        />
        {can(actor.roles, "receipt.create") ? (
          <Button render={<Link href="/purchasing/receipts/new" />}>
            <Plus data-icon="inline-start" />
            Buat Penerimaan
          </Button>
        ) : null}
      </div>

      <ReceiptsTable
        receipts={items}
        canUpdate={can(actor.roles, "receipt.update")}
        canPost={can(actor.roles, "receipt.post")}
        canCancel={can(actor.roles, "receipt.cancel")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} penerimaan terdaftar
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
