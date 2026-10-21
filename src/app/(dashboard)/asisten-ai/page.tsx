import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Asisten AI" };

export default function AsistenAiPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Asisten AI" />
      <Input
        type="text"
        name="question"
        aria-label="Pertanyaan untuk Asisten AI"
        placeholder="Tanyakan sesuatu kepada Asisten AI..."
        autoComplete="off"
        className="h-10 w-full max-w-3xl text-sm"
      />
    </div>
  );
}
