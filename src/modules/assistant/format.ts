/**
 * Rapikan Markdown ringan dari model menjadi teks biasa untuk bubble chat.
 * Konten tetap dirender sebagai teks (bukan HTML), jadi tidak ada risiko XSS.
 */
export function toPlainAssistantText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[-*]\s+/gm, "$1• ");
}
