"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Navigasi halaman tabel berbasis query `?page=` (dibaca Server Component). */
export function TablePagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase tabular-nums">
        Halaman {page} dari {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        aria-label="Halaman berikutnya"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
