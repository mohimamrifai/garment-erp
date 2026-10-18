import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CreateUserDialog } from "@/modules/user/components/create-user-dialog";
import { UserSearch } from "@/modules/user/components/user-search";
import { UsersTable } from "@/modules/user/components/users-table";
import { listUsersQuerySchema } from "@/modules/user/schemas";
import { listUsers } from "@/modules/user/service";

export const metadata: Metadata = { title: "Pengguna" };

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function UsersPage({ searchParams }: UsersPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengguna" description="Kelola akun dan role pengguna sistem." />
      <Suspense fallback={<UsersSectionSkeleton />}>
        <UsersSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function UsersSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-64" />
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

async function UsersSection({ searchParams }: UsersPageProps) {
  const actor = await requirePagePermission("user.view");
  const params = await searchParams;

  const parsed = listUsersQuerySchema.safeParse({
    query: typeof params.q === "string" ? params.q : undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const listParams = parsed.success ? parsed.data : listUsersQuerySchema.parse({});

  const { items, total } = await listUsers(listParams);
  const canManage = can(actor.roles, "user.create");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UserSearch />
        {canManage ? <CreateUserDialog /> : null}
      </div>
      <UsersTable users={items} currentUserId={actor.id} canManage={canManage} />
      <p className="text-xs text-muted-foreground">{total} pengguna terdaftar</p>
    </div>
  );
}
