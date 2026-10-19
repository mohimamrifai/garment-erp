import type { ReportColumn, ReportRow } from "./service";

/**
 * Util CSV server-side (F5 task 5.7): header label, escaping RFC 4180, dan BOM
 * agar karakter non-ASCII (Bahasa Indonesia) terbaca benar di Excel.
 */
export function toCsv(columns: readonly ReportColumn[], rows: readonly ReportRow[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const header = columns.map((column) => escape(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escape(row[column.key])).join(","),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

/** Nama file ekspor: `laporan-<slug>-<from>-<to>.csv`. */
export function reportFileName(slug: string, from: string, to: string): string {
  return `laporan-${slug}-${from}-${to}.csv`;
}
