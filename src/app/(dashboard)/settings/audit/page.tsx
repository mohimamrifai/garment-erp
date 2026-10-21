import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { AuditLogTable } from "@/modules/audit/components/audit-log-table";
import { formatAuditAction } from "@/modules/audit/format";
import { listAuditLogsQuerySchema } from "@/modules/audit/schemas";
import { listAuditActions, listAuditLogs } from "@/modules/audit/service";

export const metadata: Metadata = { title: "Audit Log" };

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AuditPage({ searchParams }: AuditPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Log"
        description="Jejak hanya-baca tindakan penting: aktor, aksi, entitas, dan waktunya."
      />
      <Suspense fallback={<AuditSectionSkeleton />}>
        <AuditSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AuditSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function AuditSection({ searchParams }: AuditPageProps) {
  await requirePagePermission("audit.view");
  const params = await searchParams;

  const parsed = listAuditLogsQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    action: typeof params.action === "string" ? params.action : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listAuditLogsQuerySchema.parse({});

  const [{ items, total }, actions] = await Promise.all([
    listAuditLogs(listParams),
    listAuditActions(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / listParams.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <ListSearch
        placeholder="Cari aksi, entitas, atau aktor..."
        ariaLabel="Cari audit log"
        status="all"
        hideStatus
        filters={[
          {
            key: "action",
            value: listParams.action ?? "all",
            allLabel: "Semua aksi",
            options: actions.map((action) => ({
              value: action,
              label: formatAuditAction(action),
            })),
            widthClass: "w-56",
            "aria-label": "Filter aksi",
          },
        ]}
      />
      <AuditLogTable rows={items} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          {total} catatan audit
        </p>
        <TablePagination page={listParams.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
