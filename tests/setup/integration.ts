/**
 * Setup tes integrasi:
 * 1. Paksa `DATABASE_URL` menunjuk ke database test (mencegah reset DB dev).
 * 2. Jalankan migrasi.
 * 3. Kosongkan seluruh tabel `public`.
 * 4. Seed data minimal: 8 role + satu user aktor untuk FK audit log.
 *
 * Berjalan sekali per file tes (project `integration` dijalankan berurutan).
 */
import "dotenv/config";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST belum di-set. Salin .env.example ke .env.");
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL_TEST tidak boleh sama dengan DATABASE_URL — setup ini menghapus isi tabel.",
  );
}
process.env.DATABASE_URL = testUrl;

const { db, sql } = await import("@/lib/db");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const { roles, user } = await import("@/lib/db/schema");
const { ROLE_SEED } = await import("@/lib/permissions");
const { TEST_ACTOR_ID } = await import("../helpers/constants");

await migrate(db, { migrationsFolder: "drizzle" });

const tables = await sql<{ tablename: string }[]>`
  select tablename from pg_tables where schemaname = 'public'
`;
if (tables.length > 0) {
  const list = tables.map((table) => `"public"."${table.tablename}"`).join(", ");
  await sql.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

await db.insert(roles).values(
  ROLE_SEED.map((role) => ({
    code: role.code,
    name: role.name,
    description: role.description,
  })),
);

await db.insert(user).values({
  id: TEST_ACTOR_ID,
  name: "Test Admin",
  email: "test-admin@garment.test",
});
