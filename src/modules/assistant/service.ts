import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { resolveAssistantPageContext } from "./context";
import { buildAssistantSystemPrompt } from "./prompt";
import type { AssistantRequest } from "./schemas";

const DEFAULT_BASE_URL = "https://ollama.com";
const DEFAULT_MODEL = "gpt-oss:20b";
const REQUEST_TIMEOUT_MS = 45_000;

const ollamaResponseSchema = z
  .object({
    message: z.object({ content: z.string() }).passthrough(),
    model: z.string().optional(),
    prompt_eval_count: z.number().optional(),
    eval_count: z.number().optional(),
  })
  .passthrough();

export type AssistantAnswer = {
  answer: string;
  model: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

function ollamaConfig(): { baseUrl: string; apiKey: string; model: string } {
  const apiKey = process.env.API_KEY_OLLAMA?.trim();
  if (!apiKey) {
    throw new ApiError(
      503,
      "ASSISTANT_NOT_CONFIGURED",
      "Asisten AI belum dikonfigurasi. Hubungi administrator.",
    );
  }

  return {
    baseUrl: (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey,
    model: process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL,
  };
}

async function ollamaError(response: Response): Promise<ApiError> {
  if (response.status === 401 || response.status === 403) {
    return new ApiError(
      503,
      "ASSISTANT_AUTH_ERROR",
      "Kunci API Asisten AI tidak valid. Hubungi administrator.",
    );
  }
  if (response.status === 402) {
    return new ApiError(
      402,
      "ASSISTANT_QUOTA_EXHAUSTED",
      "Kuota Asisten AI habis. Hubungi administrator untuk menambah kredit.",
    );
  }
  if (response.status === 429) {
    return new ApiError(
      429,
      "ASSISTANT_UPSTREAM_RATE_LIMITED",
      "Asisten AI sedang sibuk. Coba lagi beberapa saat.",
    );
  }
  if (response.status === 400 || response.status === 404) {
    return new ApiError(
      502,
      "ASSISTANT_MODEL_UNAVAILABLE",
      "Model Asisten AI tidak tersedia. Hubungi administrator.",
    );
  }

  return new ApiError(
    502,
    "ASSISTANT_UNAVAILABLE",
    "Asisten AI sedang tidak dapat dihubungi. Coba lagi.",
  );
}

/**
 * Panggil Ollama Cloud dari server. API key tidak pernah dikirim ke browser.
 * Respons dinormalisasi agar route hanya perlu menangani satu bentuk data.
 */
export async function askAssistant(
  input: AssistantRequest,
  user: SessionUser,
): Promise<AssistantAnswer> {
  const { baseUrl, apiKey, model } = ollamaConfig();
  const pageContext = input.context
    ? resolveAssistantPageContext(input.context.pathname, user.roles)
    : null;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildAssistantSystemPrompt(user, pageContext) },
          ...input.messages,
        ],
        stream: false,
        reasoning_effort: "low",
        options: {
          temperature: 0.4,
          num_predict: 1024,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "ASSISTANT_TIMEOUT", "Asisten AI terlalu lama merespons. Coba lagi.");
    }
    throw new ApiError(
      502,
      "ASSISTANT_UNAVAILABLE",
      "Asisten AI sedang tidak dapat dihubungi. Coba lagi.",
    );
  }

  if (!response.ok) {
    throw await ollamaError(response);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      502,
      "ASSISTANT_INVALID_RESPONSE",
      "Asisten AI mengembalikan respons yang tidak valid. Coba lagi.",
    );
  }

  const parsed = ollamaResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "ASSISTANT_INVALID_RESPONSE",
      "Asisten AI mengembalikan respons yang tidak valid. Coba lagi.",
    );
  }

  const answer = parsed.data.message.content.trim();
  if (!answer) {
    throw new ApiError(
      502,
      "ASSISTANT_EMPTY_RESPONSE",
      "Asisten AI tidak memberikan jawaban. Coba lagi.",
    );
  }

  return {
    answer,
    model: parsed.data.model ?? model,
    usage: {
      promptTokens: parsed.data.prompt_eval_count,
      completionTokens: parsed.data.eval_count,
    },
  };
}
