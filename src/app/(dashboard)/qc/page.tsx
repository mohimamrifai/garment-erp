import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Quality Control" };

export default function QcPage() {
  return (
    <ModulePlaceholder
      icon={ClipboardCheck}
      title="Quality Control"
      phase="Fase 4"
      description="Inspeksi kualitas per tahap produksi dan pencatatan hasil QC: lulus, rework, atau gagal."
    />
  );
}
