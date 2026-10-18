import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

/**
 * Dua project:
 * - `unit`        : logika murni, tanpa database.
 * - `integration` : service + database (memakai DATABASE_URL_TEST, di-reset per file).
 *
 * Jalankan: `pnpm test:unit`, `pnpm test:integration`, atau `pnpm verify`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          alias,
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // Reset & seeding DB per file → jalankan berurutan.
          fileParallelism: false,
          alias,
        },
      },
    ],
  },
});
