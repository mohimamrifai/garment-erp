import "dotenv/config";
import { runSeed } from "../src/lib/db/seed";
import { sql } from "../src/lib/db";

runSeed()
  .then(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed gagal:", error);
    await sql.end({ timeout: 5 });
    process.exit(1);
  });
