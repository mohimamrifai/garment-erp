"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

/** Pencarian + filter status buyer; mengubah query URL (dibaca Server Component). */
export function BuyerSearch({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function applyParams(update: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, next] of Object.entries(update)) {
      if (next) params.set(key, next);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative w-full max-w-xs"
        onSubmit={(event) => {
          event.preventDefault();
          applyParams({ q: value.trim() || null });
        }}
      >
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Cari kode, nama, atau kontak..."
          className="pl-8"
          aria-label="Cari buyer"
        />
      </form>
      <Select
        value={status}
        onValueChange={(next) => applyParams({ status: next === "all" ? null : next })}
        items={STATUS_OPTIONS}
      >
        <SelectTrigger size="default" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
