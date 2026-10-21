/**
 * Service modul produksi.
 *
 * Implementasi dipecah per tanggung jawab agar tiap modul mudah dibaca:
 * - `shared`    : helper query & penguncian yang dipakai lintas modul
 * - `planning`  : kebutuhan material dan pratinjau perencanaan
 * - `queries`   : daftar, detail, dan opsi SPK
 * - `mutations` : pembuatan dan pembatalan SPK
 * - `progress`  : output tahap, pemakaian material, dan status turunan
 * - `dashboard` : agregasi dashboard dan opsi inspeksi
 *
 * Invariant utama:
 * - SPK selalu dari item SO terkonfirmasi + BOM aktif yang dikunci.
 * - Output tahap n ≤ output lolos tahap n−1 (tahap 1 = target).
 * - Rework tidak menggandakan output: jatah rework berasal dari inspeksi QC
 *   berstatus REWORK dan dikonsumsi hanya oleh catatan `is_rework`.
 * - Pemakaian material mengurangi stok HANYA lewat inventory engine.
 */
export * from "./shared";
export * from "./planning";
export * from "./queries";
export * from "./mutations";
export * from "./progress";
export * from "./dashboard";
