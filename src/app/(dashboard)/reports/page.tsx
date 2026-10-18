import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Laporan" };

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      icon={BarChart3}
      title="Laporan"
      phase="Fase 5"
      description="Laporan order-to-shipment, stok, dan kinerja produksi dengan filter periode."
    />
  );
}
