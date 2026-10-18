import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Inventori" };

export default function InventoryPage() {
  return (
    <ModulePlaceholder
      icon={Boxes}
      title="Inventori"
      phase="Fase 3"
      description="Stok material & barang jadi, kartu stok, transfer antar gudang, dan penyesuaian — semua perubahan saldo hanya lewat inventory engine."
    />
  );
}
