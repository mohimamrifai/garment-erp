import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ListSearch } from "@/components/master-data/list-search";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AccountsTable } from "@/modules/accounting/components/accounts-table";
import { CreateAccountButton } from "@/modules/accounting/components/create-account-button";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/modules/accounting/schemas";
import { listAccounts } from "@/modules/accounting/service";

export const metadata: Metadata = { title: "Bagan Akun" };

type AccountsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AccountsPage({ searchParams }: AccountsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bagan Akun"
        description="Kelola akun buku besar, saldo normal, dan akun kas/bank."
      />
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AccountsSkeleton() {
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

async function AccountsSection({ searchParams }: AccountsPageProps) {
  const actor = await requirePagePermission("accounting.view");
  const params = await searchParams;
  const type = typeof params.type === "string" ? params.type : "all";
  const query = typeof params.q === "string" ? params.q : undefined;
  const { items, total } = await listAccounts({ type, query });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch
          placeholder="Cari kode atau nama akun..."
          ariaLabel="Cari akun"
          status="all"
          hideStatus
          filters={[
            {
              key: "type",
              value: type,
              allLabel: "Semua tipe",
              options: ACCOUNT_TYPES.map((value) => ({
                value,
                label: ACCOUNT_TYPE_LABELS[value],
              })),
              widthClass: "w-40",
              "aria-label": "Filter tipe akun",
            },
          ]}
        />
        {can(actor.roles, "accounting.manage") ? <CreateAccountButton /> : null}
      </div>

      <AccountsTable accounts={items} canManage={can(actor.roles, "accounting.manage")} />

      <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
        {total} akun ditampilkan
      </p>
    </div>
  );
}
