<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes — Garment ERP

- Baca `docs/plan.md` untuk rencana bertahap dan keputusan yang sudah dikunci
  (Better Auth, Neon, REST `/api/v1`, testing pragmatis, enum status dokumen).
- UI, pesan validasi, dan dokumentasi pengguna menggunakan Bahasa Indonesia.
- **Mutasi data:** REST di `/api/v1` — route handler tipis (`auth → Zod → service → respons`).
  **Baca data:** langsung via service layer dari Server Components (jangan fetch ke diri sendiri).
- **Cache Components aktif** (`cacheComponents: true`): bungkus pembacaan data uncached/runtime
  (DB, `cookies()`, `headers()`) dalam `<Suspense>`; gunakan `use cache` bila data layak dicache.
- Jangan pernah menulis saldo stok langsung ke tabel; semua perubahan stok lewat inventory engine
  (Fase 3). Operasi multi-tabel wajib dalam satu transaksi DB + audit log.
- Format respons API: sukses `{ data, meta? }`; error `{ error: { code, message, details? } }`.

## Testing

- `pnpm verify` = lint + typecheck + unit + integration. Jalankan sebelum commit besar.
- Unit: logika murni tanpa DB. Integration: `tests/integration` memakai `DATABASE_URL_TEST`
  (di-reset otomatis per file via `tests/setup/integration.ts`; jangan arahkan ke DB dev).
- E2E Playwright WAJIB terhadap build produksi: `pnpm build` lalu `pnpm test:e2e`
  (hentikan dev server dulu — Playwright menyalakan `next start` di port 3000).
  Dev server membuat E2E lambat/flaky karena kompilasi on-demand; jangan dijadikan target.
- Rate limit Better Auth (produksi: 3 percobaan/10 dtk untuk `/sign-in`) dimatikan khusus E2E
  lewat `E2E_DISABLE_RATE_LIMIT=1` yang di-set di `playwright.config.ts`.
- Selector Playwright: pakai role + `exact: true` bila teks bisa jadi substring elemen lain
  (mis. "Buyer" vs "Kelola Buyer").

