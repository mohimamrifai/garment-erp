import type { Metadata } from "next";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Asisten AI" };

export default function AsistenAiPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Asisten AI</h1>
        <Input
          type="text"
          name="question"
          aria-label="Pertanyaan untuk Asisten AI"
          placeholder="Tanyakan sesuatu kepada Asisten AI..."
          autoComplete="off"
          className="h-12 w-full rounded-xl px-4 text-base shadow-sm"
        />
      </div>
    </div>
  );
}
