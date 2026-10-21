import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleCode } from "@/lib/permissions";
import { toPlainAssistantText } from "@/modules/assistant/format";
import { buildAssistantSystemPrompt } from "@/modules/assistant/prompt";
import { assistantRequestSchema } from "@/modules/assistant/schemas";
import { askAssistant } from "@/modules/assistant/service";

const USER = {
  id: "user-test",
  name: "Admin Test",
  email: "admin@garment.test",
  roles: ["ADMIN"] as RoleCode[],
};

const originalApiKey = process.env.API_KEY_OLLAMA;
const originalBaseUrl = process.env.OLLAMA_BASE_URL;
const originalModel = process.env.OLLAMA_MODEL;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env.API_KEY_OLLAMA = "test-key";
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.API_KEY_OLLAMA;
  else process.env.API_KEY_OLLAMA = originalApiKey;

  if (originalBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalBaseUrl;

  if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = originalModel;

  vi.unstubAllGlobals();
});

describe("skema Asisten AI", () => {
  it("menerima percakapan valid yang diakhiri pesan pengguna", () => {
    const parsed = assistantRequestSchema.safeParse({
      messages: [
        { role: "user", content: "Apa itu SPK?" },
        { role: "assistant", content: "SPK adalah surat perintah kerja." },
        { role: "user", content: "Di mana melihatnya?" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("menolak percakapan kosong dan pesan kosong", () => {
    expect(assistantRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(
      assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "   " }] }).success,
    ).toBe(false);
  });

  it("menolak pesan terakhir dari asisten", () => {
    const parsed = assistantRequestSchema.safeParse({
      messages: [{ role: "assistant", content: "Halo" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak riwayat lebih dari 12 pesan", () => {
    const messages = Array.from({ length: 13 }, (_, index) => ({
      role: index === 12 ? "user" : "assistant",
      content: `Pesan ${index}`,
    }));
    expect(assistantRequestSchema.safeParse({ messages }).success).toBe(false);
  });

  it("menolak total karakter percakapan yang terlalu panjang", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: index === 11 ? "user" : "assistant",
      content: "x".repeat(1_400),
    }));
    expect(assistantRequestSchema.safeParse({ messages }).success).toBe(false);
  });
});

describe("format jawaban Asisten AI", () => {
  it("membersihkan penanda Markdown ringan tanpa merusak teks", () => {
    expect(
      toPlainAssistantText("Buka **Inventori** lalu `Mutasi Stok`.\n### Langkah\n- Satu\n- Dua"),
    ).toBe("Buka Inventori lalu Mutasi Stok.\nLangkah\n• Satu\n• Dua");
  });
});

describe("prompt Asisten AI", () => {
  it("menyertakan role pengguna dan larangan mengarang data", () => {
    const prompt = buildAssistantSystemPrompt(USER);
    expect(prompt).toContain("Administrator");
    expect(prompt).toContain("BELUM terhubung ke database");
    expect(prompt).toContain("Jangan mengarang angka stok");
    expect(prompt).not.toContain(process.env.API_KEY_OLLAMA);
  });
});

describe("service Asisten AI", () => {
  it("memanggil Ollama Cloud dengan model dan system prompt yang benar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        message: { content: "Stok dapat dilihat di menu Inventori." },
        model: "gpt-oss:20b",
        prompt_eval_count: 120,
        eval_count: 20,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await askAssistant(
      { messages: [{ role: "user", content: "Di mana melihat stok?" }] },
      USER,
    );

    expect(result).toMatchObject({
      answer: "Stok dapat dilihat di menu Inventori.",
      model: "gpt-oss:20b",
      usage: { promptTokens: 120, completionTokens: 20 },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.com/api/chat");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });

    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { role: string; content: string }[];
      stream: boolean;
      reasoning_effort: string;
    };
    expect(body.model).toBe("gpt-oss:20b");
    expect(body.stream).toBe(false);
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]).toEqual({ role: "user", content: "Di mana melihat stok?" });
  });

  it("memetakan kuota Ollama habis menjadi error 402", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "quota" }, 402)));

    await expect(
      askAssistant({ messages: [{ role: "user", content: "Halo" }] }, USER),
    ).rejects.toMatchObject({
      status: 402,
      code: "ASSISTANT_QUOTA_EXHAUSTED",
    });
  });

  it("menolak request jika API key belum dikonfigurasi", async () => {
    delete process.env.API_KEY_OLLAMA;

    await expect(
      askAssistant({ messages: [{ role: "user", content: "Halo" }] }, USER),
    ).rejects.toMatchObject({
      status: 503,
      code: "ASSISTANT_NOT_CONFIGURED",
    });
  });

  it("menolak respons Ollama yang tidak berisi jawaban", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ message: { content: "   " }, model: "gpt-oss:20b" })),
    );

    await expect(
      askAssistant({ messages: [{ role: "user", content: "Halo" }] }, USER),
    ).rejects.toMatchObject({
      status: 502,
      code: "ASSISTANT_EMPTY_RESPONSE",
    });
  });
});
