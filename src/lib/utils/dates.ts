/**
 * Utilitas waktu terpusat.
 * Konvensi proyek: simpan `timestamptz` (UTC) di database, tampilkan
 * dalam zona waktu Asia/Jakarta.
 */
export const TIME_ZONE = "Asia/Jakarta";

/** Periode penomoran dokumen berdasarkan kalender Jakarta, format `YYYYMM`. */
export function getDocumentPeriod(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}${month}`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Contoh: "18 Okt 2026, 14.05 WIB". */
export function formatDateTimeId(value: Date | string | number): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
  return `${formatted} WIB`;
}

/** Contoh: "18 Okt 2026". */
export function formatDateId(value: Date | string | number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
  }).format(toDate(value));
}

/** Tanggal hari ini (YYYY-MM-DD) menurut kalender Asia/Jakarta. */
export function getTodayDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Tanggal (YYYY-MM-DD) `days` hari dari sekarang menurut kalender Asia/Jakarta. */
export function getDateOffset(days: number, from: Date = new Date()): string {
  const shifted = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return getTodayDate(shifted);
}
