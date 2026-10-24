import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateJournalButton } from "@/modules/accounting/components/create-journal-button";
import { JournalsTable } from "@/modules/accounting/components/journals-table";
import { listJournalsQuerySchema } from "@/modules/accounting/schemas";
import { listAccounts, listJournals } from "@/modules/accounting/service";
import { JOURNAL_STATUS_LABELS } from "@/modules/accounting/status";

export const metadata: Metadata = { title: "Jurnal" };

type JournalsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function JournalsPage({ searchParams }: JournalsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jurnal"
        description="Jurnal umum otomatis dan manual. Jurnal posted tidak dapat diubah."
      />
      <Suspense fallback={<JournalsSkeleton />}>
        <JournalsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function JournalsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

async function JournalsSection({ searchParams }: JournalsPageProps) {
  const actor = await requirePagePermission("accounting.view");
  const params = await searchParams;
  const parsed = listJournalsQuerySchema.safeParse({
    query: params.q,
    status: params.status,
    page: params.page,
  });
  const listParams = parsed.success ? parsed.data : listJournalsQuerySchema.parse({});
  const [{ items, total }, accounts] = await Promise.all([
    listJournals(listParams),
    can(actor.roles, "accounting.manage")
      ? listAccounts({ type: "all" })
      : Promise.resolve({ items: [], total: 0 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari nomor atau keterangan jurnal..."
          ariaLabel="Cari jurnal"
          status="all"
          hideStatus
          filters={[
            {
              key: "status",
              value: listParams.status,
              allLabel: "Semua status",
              options: Object.entries(JOURNAL_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
              widthClass: "w-40",
              "aria-label": "Filter status jurnal",
            },
          ]}
        />
        {can(actor.roles, "accounting.manage") ? (
          <CreateJournalButton accounts={accounts.items} />
        ) : null}
      </div>

      <JournalsTable journals={items} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} jurnal ditampilkan
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
