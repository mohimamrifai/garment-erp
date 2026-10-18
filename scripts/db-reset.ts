import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "../src/lib/db";
import { runSeed } from "../src/lib/db/seed";

/**
 * Reset database dev: hapus seluruh schema `public`, jalankan ulang semua
 * migrasi, lalu seed. Hanya untuk development.
 */
async function main(): Promise<void> {
  console.log(`Reset database: ${safeUrl(process.env.DATABASE_URL)}`);
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");

  console.log("Menjalankan migrasi...");
  await migrate(db, { migrationsFolder: "drizzle" });

  await runSeed();
}

function safeUrl(url: string | undefined): string {
  if (!url) return "(DATABASE_URL kosong)";
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(tidak valid)";
  }
}

main()
  .then(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Reset gagal:", error);
    await sql.end({ timeout: 5 });
    process.exit(1);
  });
