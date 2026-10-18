import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Sales Order" };

export default function SalesPage() {
  return (
    <ModulePlaceholder
      icon={ShoppingCart}
      title="Sales Order"
      phase="Fase 2"
      description="Pembuatan sales order (SO), konfirmasi, dan penjadwalan produksi — termasuk penomoran otomatis SO-YYYYMM-#### serta alur status DRAFT → CONFIRMED → IN_PRODUCTION → READY_TO_SHIP → SHIPPED → COMPLETED."
    />
  );
}
