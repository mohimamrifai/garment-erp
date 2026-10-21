import { z } from "zod";

export const ASSISTANT_MAX_MESSAGES = 12;
export const ASSISTANT_MAX_MESSAGE_CHARS = 6_000;
export const ASSISTANT_MAX_TOTAL_CHARS = 16_000;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Pesan tidak boleh kosong.")
    .max(
      ASSISTANT_MAX_MESSAGE_CHARS,
      `Pesan maksimal ${ASSISTANT_MAX_MESSAGE_CHARS.toLocaleString("id-ID")} karakter.`,
    ),
});

export const assistantContextSchema = z
  .object({
    pathname: z
      .string()
      .trim()
      .min(1, "Konteks halaman tidak valid.")
      .max(200, "Konteks halaman terlalu panjang.")
      .refine(
        (value) => value.startsWith("/") && !value.startsWith("//"),
        "Konteks halaman tidak valid.",
      )
      .refine(
        (value) => !value.includes("..") && !/[\\?#]/.test(value),
        "Konteks halaman tidak valid.",
      ),
  })
  .strict();

export const assistantRequestSchema = z
  .object({
    messages: z
      .array(assistantMessageSchema)
      .min(1, "Kirim setidaknya satu pesan.")
      .max(
        ASSISTANT_MAX_MESSAGES,
        `Maksimal ${ASSISTANT_MAX_MESSAGES} pesan dalam satu percakapan.`,
      ),
    context: assistantContextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const lastMessage = value.messages.at(-1);
    if (lastMessage?.role !== "user") {
      ctx.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Pesan terakhir harus berasal dari pengguna.",
      });
    }

    const totalChars = value.messages.reduce((total, message) => total + message.content.length, 0);
    if (totalChars > ASSISTANT_MAX_TOTAL_CHARS) {
      ctx.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Percakapan terlalu panjang. Mulai percakapan baru atau persingkat pesan.",
      });
    }
  });

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantContext = z.infer<typeof assistantContextSchema>;
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
