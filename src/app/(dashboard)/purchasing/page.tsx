import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Pembelian" };

export default function PurchasingPage() {
  return (
    <ModulePlaceholder
      icon={FileText}
      title="Pembelian"
      phase="Fase 3"
      description="Purchase order (PO), penerimaan material dengan pembaruan stok otomatis, dan penomoran PO-/RCV- beserta riwayat harga beli."
    />
  );
}
