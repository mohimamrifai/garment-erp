/**
 * Deteksi pelanggaran constraint UNIQUE PostgreSQL (SQLSTATE 23505) dari error
 * driver `postgres`. Dipakai service untuk memberi pesan konflik yang ramah
 * alih-alih 500 saat dua permintaan menyentuh nilai unik yang sama.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
