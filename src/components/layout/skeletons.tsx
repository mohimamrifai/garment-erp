import { Skeleton } from "@/components/ui/skeleton";

/** Fallback saat data sesi untuk sidebar sedang dimuat (streaming). */
export function SidebarSkeleton() {
  return (
    <div className="hidden w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-2 md:flex">
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Fallback saat data sesi untuk header sedang dimuat (streaming). */
export function HeaderSkeleton() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Skeleton className="size-7" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="ml-auto h-7 w-28 rounded-lg" />
    </div>
  );
}
