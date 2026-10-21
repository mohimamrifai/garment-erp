"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
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
] as const;

export type ListSearchFilter = {
  /** Nama query param, mis. "warehouse". */
  key: string;
  /** Nilai terpilih saat ini; "all" bila tidak ada filter. */
  value: string;
  /** Label untuk pilihan "semua", mis. "Semua gudang". */
  allLabel: string;
  options: readonly { value: string; label: string }[];
  /** Lebar select (kelas Tailwind), default w-40. */
  widthClass?: string;
  "aria-label"?: string;
};

type ListSearchProps = {
  placeholder: string;
  ariaLabel: string;
  /** Nilai filter status saat ini (all|active|inactive). */
  status: string;
  /** Sembunyikan filter status (untuk daftar tanpa is_active). */
  hideStatus?: boolean;
  /** Filter select tambahan (mis. per gudang / departemen). */
  filters?: readonly ListSearchFilter[];
};

/**
 * Toolbar pencarian + filter standar untuk halaman daftar master data.
 * Mengubah query URL; Server Component membaca dan memakainya untuk query.
 */
export function ListSearch({
  placeholder,
  ariaLabel,
  status,
  hideStatus = false,
  filters = [],
}: ListSearchProps) {
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
        className="relative w-full sm:w-80"
        onSubmit={(event) => {
          event.preventDefault();
          applyParams({ q: value.trim() || null });
        }}
      >
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="pr-8 pl-8"
          aria-label={ariaLabel}
        />
        {value ? (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => {
              setValue("");
              applyParams({ q: null });
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      {hideStatus ? null : (
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
      )}

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filter.value}
          onValueChange={(next) => applyParams({ [filter.key]: next === "all" ? null : next })}
          items={[{ value: "all", label: filter.allLabel }, ...filter.options]}
        >
          <SelectTrigger
            size="default"
            className={filter.widthClass ?? "w-40"}
            aria-label={filter["aria-label"]}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{filter.allLabel}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
