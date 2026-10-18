"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Pencarian pengguna; menekan Enter memperbarui query URL (dibaca server). */
export function UserSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function applySearch(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("q", next);
    else params.delete("q");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <form
      className="relative w-full max-w-xs"
      onSubmit={(event) => {
        event.preventDefault();
        applySearch(value.trim());
      }}
    >
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cari nama atau email..."
        className="pl-8"
        aria-label="Cari pengguna"
      />
    </form>
  );
}
