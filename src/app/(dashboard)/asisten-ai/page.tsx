import type { Metadata } from "next";
import { AssistantChat } from "./_components/assistant-chat";

export const metadata: Metadata = { title: "Asisten AI" };

export default function AsistenAiPage() {
  return <AssistantChat />;
}
