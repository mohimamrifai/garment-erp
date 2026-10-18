import type { Metadata } from "next";
import { Factory } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Produksi" };

export default function ProductionPage() {
  return (
    <ModulePlaceholder
      icon={Factory}
      title="Produksi"
      phase="Fase 4"
      description="SPK produksi per sales order, tahapan pekerjaan, pemakaian material, dan pencatatan progres produksi."
    />
  );
}
