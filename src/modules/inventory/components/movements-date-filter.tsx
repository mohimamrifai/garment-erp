"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

type MovementsDateFilterProps = {
  from: string;
  to: string;
};

/** Filter rentang tanggal mutasi — menulis query `from`/`to` ke URL. */
export function MovementsDateFilter({ from, to }: MovementsDateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams);
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="Dari tanggal"
        className="nums w-36 font-mono"
        value={from}
        onChange={(event) => apply(event.target.value, to)}
      />
      <span className="text-xs text-muted-foreground">s.d.</span>
      <Input
        type="date"
        aria-label="Sampai tanggal"
        className="nums w-36 font-mono"
        value={to}
        onChange={(event) => apply(from, event.target.value)}
      />
    </div>
  );
}
