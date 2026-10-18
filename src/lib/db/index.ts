import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum di-set. Salin .env.example ke .env terlebih dahulu.");
}

// Endpoint pooled Neon (PgBouncer, mode transaction) tidak mendukung prepared
// statements — matikan `prepare` bila terdeteksi. Untuk lokal/biaya, `prepare`
// tetap aktif agar lebih cepat.
const isPooled = connectionString.includes("-pooler");

// Cache koneksi di global saat dev agar hot-reload Next.js tidak membuat
// koneksi baru terus-menerus.
const globalForDb = globalThis as unknown as {
  __garmentSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__garmentSql ??
  postgres(connectionString, {
    max: 10,
    prepare: !isPooled,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__garmentSql = sql;
}

export const db = drizzle(sql, { schema });

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
/** Diterima oleh fungsi yang bisa dipakai di dalam maupun luar transaksi. */
export type DbExecutor = DbClient | DbTransaction;
