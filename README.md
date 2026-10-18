# Garment ERP System

[![CI](https://github.com/mohimamrifai/garment-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/mohimamrifai/garment-erp/actions/workflows/ci.yml)

Aplikasi web ERP (Enterprise Resource Planning) untuk industri manufaktur garmen: mengelola alur
**Sales Order → Material Planning → Purchasing → Material Receipt → Production → QC → Finished Goods → Shipment → Reporting**
dalam satu sumber data terpusat dengan kontrol akses berbasis role.

Proyek ini dibangun sebagai portofolio full-stack dengan MVP 11 modul P0. Kebutuhan lengkap ada di
[`PRD.md`](./PRD.md), rencana pengerjaan bertahap ada di [`docs/plan.md`](./docs/plan.md).

## Demo

🔗 **[garment-erp-olive.vercel.app](https://garment-erp-olive.vercel.app)** — masuk memakai akun demo
di bawah (mis. `admin@garment.local` / `password123`). Deploy di Vercel (region `sin1`) + Neon
Postgres (Singapore); database produksi di-seed dengan data contoh yang sama seperti `pnpm db:seed`.

## Status

| Fase | Lingkup                                                  | Status     |
| ---- | -------------------------------------------------------- | ---------- |
| F1   | Fondasi: auth, RBAC, audit, master data buyer, dashboard | ✅ Selesai |
| F2   | Master data lengkap + BOM + Sales Order                  | ✅ Selesai |
| F3   | Purchasing, penerimaan material, inventory engine        | ✅ Selesai |
| F4   | Produksi (SPK), QC                                       | ✅ Selesai |
| F5   | Pengiriman, laporan                                      | ⏳ Berikut |
| F6   | Polish, dokumentasi, deploy demo                         | ⏳ Rencana |

> F1 juga mencakup **design system "Pabrik"** (identitas visual, token, komponen) —
> dokumentasi di [`docs/design-system.md`](docs/design-system.md).
> F2 mencakup master data organisasi & produk (departemen, karyawan, lini, supplier,
> satuan, material, produk + varian, gudang + lokasi), **BOM berversi** (versi aktif
> beku — revisi lewat versi baru), dan modul **Sales Order** (draf → konfirmasi →
> pembatalan beralasan, penomoran `SO-YYYYMM-####`).
> F3 mencakup **inventory engine** (satu-satunya jalur perubahan saldo: transaksi
> immutable, idempotent, aman konkurensi), **Purchase Order**
> (`PO-YYYYMM-####`: draf → dipesan → diterima sebagian/lengkap, batal bersyarat),
> **Penerimaan Material** (`RCV-YYYYMM-####`: draf → diposting, lokasi per dokumen),
> serta operasi **transfer** (`TRX-YYYYMM-####`) dan **penyesuaian stok** beralasan.
> F4 mencakup **material planning** (rumus FR-07: bruto + cadangan − tersedia −
> penerimaan terjadwal; tombol buat PO prefill dari kekurangan), **gate ketersediaan**
> sebelum SPK (kekurangan boleh jalan hanya dengan alasan supervisor yang tercatat),
> **SPK** (`SPK-YYYYMM-####`: terbuka → berjalan → selesai, 4 tahap otomatis
> cutting/sewing/finishing/packing, BOM terkunci), **output tahap** dengan kontrol
> kuantitas antar-tahap, **pemakaian material** (`MIS-YYYYMM-####`) lewat inventory
> engine, serta **QC** (`QC-YYYYMM-####`: lolos/gagal/rework + rincian cacat) dengan
> alur **rework** ber-`parent_inspection_id` tanpa menggandakan output.

## Stack

| Layer     | Teknologi                                                              |
| --------- | ---------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript strict, Cache Components)           |
| UI        | Tailwind CSS v4 + shadcn/ui (Base UI) + design system "Pabrik" (IBM Plex Sans/Mono), React Hook Form + Zod |
| Database  | PostgreSQL (Docker lokal untuk dev, Neon untuk deploy)                 |
| ORM       | Drizzle ORM + Drizzle Kit                                              |
| Auth      | Better Auth (email + password, RBAC via tabel `roles`/`user_roles`)    |
| API       | REST via Route Handlers di `/api/v1` (semua mutasi)                    |
| Testing   | Vitest (unit + integration) dan Playwright (E2E)                       |

## Menjalankan secara lokal

Prasyarat: Node.js >= 20.9, pnpm 10, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Siapkan environment
cp .env.example .env

# 3. Nyalakan PostgreSQL (dev + test db) di localhost:5435
docker compose up -d

# 4. Migrasi & seed database
pnpm db:migrate
pnpm db:seed

# 5. Jalankan aplikasi
pnpm dev
```

Buka http://localhost:3000 — Anda akan diarahkan ke halaman masuk.

## Akun demo

Semua akun memakai password `password123` (dibuat oleh `pnpm db:seed`).

| Email                      | Role                |
| -------------------------- | ------------------- |
| `admin@garment.local`      | Administrator       |
| `manager@garment.local`    | Manager             |
| `sales@garment.local`      | Sales               |
| `purchasing@garment.local` | Purchasing          |
| `warehouse@garment.local`  | Gudang              |
| `produksi@garment.local`   | Supervisor Produksi |
| `qc@garment.local`         | Staff QC            |
| `shipping@garment.local`   | Staff Pengiriman    |

RBAC menerapkan satu user bisa memiliki banyak role; role `ADMIN` adalah satu-satunya yang dapat
mengelola pengguna dan melihat audit log.

Pada deployment demo (`NEXT_PUBLIC_DEMO_MODE=1`, mis. versi Vercel proyek ini) halaman login
menampilkan tombol **masuk cepat** per role — satu klik untuk masuk tanpa mengetik kredensial.
Pada deployment non-demo (variabel tidak diisi), tombol disembunyikan.

## Skrip

| Skrip                                                      | Fungsi                                           |
| ---------------------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                                 | Jalankan dev server (Turbopack)                  |
| `pnpm build` / `pnpm start`                                | Build & jalankan produksi                        |
| `pnpm lint` / `pnpm typecheck` / `pnpm format`             | Kualitas kode                                    |
| `pnpm typegen`                                             | Generate tipe Next (rute/layout) untuk typecheck |
| `pnpm test:unit`                                           | Tes unit (tanpa database)                        |
| `pnpm test:integration`                                    | Tes integrasi (memakai `DATABASE_URL_TEST`)      |
| `pnpm test:e2e`                                            | Playwright E2E (jalankan `pnpm build` dulu)      |
| `pnpm verify`                                              | lint + typecheck + unit + integration            |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:reset` | Drizzle Kit & seed                               |
| `pnpm db:studio`                                           | Drizzle Studio                                   |

## Testing

- **Unit** — logika murni: matriks izin, format tanggal/periode dokumen Jakarta, skema Zod,
  transisi status sales order, purchase order, serta aritmetika & aturan inventory engine.
- **Integration** — service + PostgreSQL nyata (`garment_erp_test`, di-reset otomatis per file),
  termasuk penomoran dokumen atomik saat 10 transaksi paralel, siklus SO (buat → konfirmasi →
  batal), guard nonaktif master data terpakai, versi BOM, siklus PO (pesan → terima sebagian →
  terima lengkap), posting penerimaan via engine (idempotent, anti over-receipt), transfer
  atomik dua sisi, penyesuaian beralasan, dan backstop CHECK database untuk saldo.
- **E2E Playwright** — alur nyata di browser: login, logout, penyaringan menu per role, penolakan
  akses halaman admin, vertical slice buyer (buat, cari, nonaktifkan), sales order
  (buat draf → konfirmasi → batalkan), purchasing (PO → pesan → terima → posting stok),
  dan operasi gudang (transfer + penyesuaian stok).

E2E berjalan terhadap **build produksi** (`next start`), bukan dev server, agar stabil:

```bash
pnpm db:migrate && pnpm db:seed   # sekali saja
pnpm build
pnpm test:e2e
```

Playwright menyalakan `next start` sendiri di port 3000 (hentikan dev server terlebih dahulu bila
sedang berjalan). Rate limit Better Auth dimatikan hanya untuk E2E lewat env
`E2E_DISABLE_RATE_LIMIT=1` yang di-set otomatis oleh konfigurasi Playwright.

## Struktur

```text
src/
  app/
    (auth)/            # halaman masuk
    (dashboard)/       # shell dashboard: sidebar per role, header, breadcrumb
    api/v1/            # REST mutasi (route handler tipis: auth → Zod → service)
  components/
    ui/                # shadcn/ui (Base UI + preset base-nova)
    layout/            # sidebar, header, breadcrumb, pagination, placeholder modul
  modules/             # modul bisnis: schemas + service + components per domain
    buyer/  user/      # F1: master data buyer & manajemen pengguna
    master/            # F2: organisasi, supplier, satuan, material, produk, gudang, BOM
    sales-order/       # F2: sales order + status & transisinya
    purchasing/        # F3: purchase order, penerimaan material
    inventory/         # F3: inventory engine, saldo, mutasi, transfer, penyesuaian
    production/        # F4: SPK, material planning, output tahap, pemakaian material
    qc/                # F4: inspeksi per tahap, rincian cacat, rework
  lib/
    auth/              # konfigurasi Better Auth, DAL sesi, guard API
    db/                # koneksi Drizzle + schema + seed
    api/               # ApiError, format respons { data, meta } / { error }
    utils/             # tanggal (Asia/Jakarta), mata uang, penomoran dokumen
  proxy.ts             # pemeriksaan cookie optimistis (pengganti middleware)
tests/
  unit/ integration/ e2e/
drizzle/               # migrasi SQL
docs/                  # plan.md (rencana bertahap), design-system.md
```

## Konvensi penting

- **Mutasi** data lewat REST `/api/v1` (route handler tipis), **pembacaan** langsung via service
  layer dari Server Component.
- Respons API: sukses `{ data, meta? }`; error `{ error: { code, message, details? } }`.
- Cache Components aktif: pembacaan runtime (DB, cookie, header) dibungkus `<Suspense>`;
  halaman memakai pola Partial Prerender (shell statis + bagian dinamis mengalir).
- Setiap mutasi multi-tabel berada dalam satu transaksi database bersama baris audit log
  (`recordAudit(tx, ...)`).
- Penomoran dokumen atomik via tabel `document_sequences`
  (`SO-/PO-/RCV-/SPK-/MIS-/QC-/SJ-YYYYMM-####` mengikuti kalender Asia/Jakarta; buyer memakai counter
  global `BUY-0001`).
- Semua perubahan saldo stok **wajib** melalui inventory engine (`src/modules/inventory/engine.ts`):
  transaksi immutable + saldo diperbarui dalam satu transaksi DB, dengan kunci idempotensi
  untuk endpoint posting.
- Bahasa visual mengikuti `docs/design-system.md`: token di `src/app/globals.css` (jangan
  menulis warna literal), angka/kode selalu `font-mono` + tabular, satu aksen oranye untuk
  fokus/nav aktif, sidebar selalu graphite gelap di kedua mode tema.

## Batasan

Mengikuti batasan paket gratis (Vercel + Neon) untuk keperluan demonstrasi; bukan jaminan
kesiapan produksi. Lihat bagian "Deployment & Cost Constraints" pada `PRD.md`.
