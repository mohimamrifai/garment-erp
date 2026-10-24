"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PaymentFilters({ type }: { type: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("type");
    else params.set("type", next);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select
      value={type}
      onValueChange={(next) => apply(next ?? "all")}
      items={[
        { value: "all", label: "Semua jenis" },
        { value: "RECEIPT", label: "Penerimaan" },
        { value: "PAYMENT", label: "Pembayaran" },
      ]}
    >
      <SelectTrigger className="w-40" aria-label="Filter jenis pembayaran">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">Semua jenis</SelectItem>
          <SelectItem value="RECEIPT">Penerimaan</SelectItem>
          <SelectItem value="PAYMENT">Pembayaran</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
