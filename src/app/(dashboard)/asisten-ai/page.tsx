import type { Metadata } from "next";
import { AssistantInput } from "./_components/assistant-input";

export const metadata: Metadata = { title: "Asisten AI" };

export default function AsistenAiPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Asisten AI</h1>
        <AssistantInput />
      </div>
    </div>
  );
}
