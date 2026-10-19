/**
 * Kalkulasi laporan & dashboard (PRD FR-02/FR-11, F5 task 5.5–5.7) — logika
 * murni tanpa DB, dipakai service laporan sekaligus unit test.
 */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Tingkat cacat (%) = kuantitas cacat ÷ kuantitas diperiksa × 100.
 * Mengembalikan 0 bila tidak ada pemeriksaan (bukan NaN/tak hingga).
 */
export function computeDefectRate(inspectedQuantity: number, rejectedQuantity: number): number {
  if (inspectedQuantity <= 0) return 0;
  return round2((rejectedQuantity / inspectedQuantity) * 100);
}

/**
 * Pencapaian (%) = aktual ÷ target × 100. Mengembalikan `null` bila target 0
 * (tanpa target, bukan 0%).
 */
export function computeAttainmentPercentage(
  targetQuantity: number,
  actualQuantity: number,
): number | null {
  if (targetQuantity <= 0) return null;
  return round2((actualQuantity / targetQuantity) * 100);
}

/** Maksimum yang dipakai pembagi agar persentase tidak melebihi 100 (untuk bar). */
export function clampPercentage(value: number | null): number {
  if (value === null) return 0;
  return Math.max(0, Math.min(100, value));
}
