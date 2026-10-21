"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
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
      className="relative w-full sm:w-80"
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
        className="pr-8 pl-8"
        aria-label="Cari pengguna"
      />
      {value ? (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => {
            setValue("");
            applySearch("");
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </form>
  );
}
