"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";
import { toPlainAssistantText } from "@/modules/assistant/format";
import { AssistantInput } from "./assistant-input";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type AssistantResponse = {
  answer: string;
  model: string;
};

const MAX_HISTORY_MESSAGES = 12;

function createId(): string {
  return crypto.randomUUID();
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function handleSubmit() {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: question,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await requestJson<AssistantResponse>("/api/v1/assistant", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({
            role,
            content,
          })),
        }),
        signal: controller.signal,
      });

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : "Asisten AI sedang tidak dapat dihubungi. Coba lagi.",
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col",
          isEmpty && "justify-center",
        )}
      >
        {isEmpty ? (
          <h1 className="mb-4 text-center text-xl font-semibold tracking-tight">Asisten AI</h1>
        ) : (
          <div
            className="min-h-0 flex-1 space-y-6 overflow-y-auto py-2 pr-1"
            aria-live="polite"
            aria-label="Percakapan dengan Asisten AI"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex flex-col gap-1",
                  message.role === "user" ? "items-end" : "items-start",
                )}
              >
                <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  {message.role === "user" ? "Anda" : "Asisten"}
                </span>
                <div
                  className={cn(
                    "max-w-[90%] text-sm leading-6 break-words whitespace-pre-wrap",
                    message.role === "user"
                      ? "rounded-xl bg-muted px-3 py-2 text-foreground"
                      : "text-foreground",
                  )}
                >
                  {message.role === "assistant"
                    ? toPlainAssistantText(message.content)
                    : message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-start gap-1" role="status">
                <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Asisten
                </span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Asisten sedang menulis...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className={cn("w-full", !isEmpty && "pt-3")}>
          <AssistantInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            loading={loading}
          />
          {error && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
