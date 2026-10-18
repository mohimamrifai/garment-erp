/** Format angka & mata uang (Rupiah) untuk tampilan Bahasa Indonesia. */

export function formatIdr(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

/** Format kuantitas stok/BOM dengan hingga 4 desimal. */
export function formatQty(value: number | string, maximumFractionDigits = 4): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits }).format(n);
}
