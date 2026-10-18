import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Pengiriman" };

export default function ShippingPage() {
  return (
    <ModulePlaceholder
      icon={Truck}
      title="Pengiriman"
      phase="Fase 5"
      description="Surat jalan (SJ), pengiriman bertahap, dan penyelesaian sales order sampai barang diterima buyer."
    />
  );
}
