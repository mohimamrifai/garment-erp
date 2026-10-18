# Garment ERP System

Aplikasi web ERP (Enterprise Resource Planning) untuk industri manufaktur garmen: mengelola alur
**Sales Order → Material Planning → Purchasing → Material Receipt → Production → QC → Finished Goods → Shipment → Reporting**
dalam satu sumber data terpusat dengan kontrol akses berbasis role.

Proyek ini dibangun sebagai portofolio full-stack dengan MVP 11 modul P0. Kebutuhan lengkap ada di
[`PRD.md`](./PRD.md), rencana pengerjaan bertahap ada di [`docs/plan.md`](./docs/plan.md).

## Stack

| Layer     | Teknologi                                                           |
| --------- | ------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript strict, Cache Components)        |
| UI        | Tailwind CSS v4 + shadcn/ui, React Hook Form + Zod, Recharts        |
| Database  | PostgreSQL (Docker lokal untuk dev, Neon untuk deploy)              |
| ORM       | Drizzle ORM + Drizzle Kit                                           |
| Auth      | Better Auth (email + password, RBAC via tabel `roles`/`user_roles`) |
| API       | REST via Route Handlers di `/api/v1` (semua mutasi)                 |
| Testing   | Vitest (unit + integration) dan Playwright (E2E)                    |

## Menjalankan secara lokal

Prasyarat: Node.js >= 20.9, pnpm 10, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Siapkan environment
cp .env.example .env

# 3. Nyalakan PostgreSQL (dev + test db) di localhost:5435
docker compose up -d

# 4. Migrasi & seed database (tersedia mulai Fase 1)
pnpm db:migrate
pnpm db:seed

# 5. Jalankan aplikasi
pnpm dev
```

Buka http://localhost:3000.

## Skrip

| Skrip                                              | Fungsi                          |
| -------------------------------------------------- | ------------------------------- |
| `pnpm dev`                                         | Jalankan dev server (Turbopack) |
| `pnpm build` / `pnpm start`                        | Build & jalankan produksi       |
| `pnpm lint`                                        | ESLint                          |
| `pnpm typecheck`                                   | TypeScript tanpa emit           |
| `pnpm format` / `pnpm format:check`                | Prettier                        |
| `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset` | Database (menyusul di Fase 1)   |

## Struktur

```text
src/
  app/        # routes (App Router), grup (auth) dan (dashboard), API /api/v1
  components/ # ui (shadcn), layout, shared
  modules/    # modul bisnis: schema, service, repository, actions, components
  lib/        # auth, db (schema + client), permissions, validation, utils
docs/         # plan.md, api.md, demo.md (menyusul)
```

## Akun demo

Menyusul pada Fase 6 (satu akun per role: Admin, Manager, Sales, Purchasing, Warehouse, Production
Supervisor, QC Staff, Shipping Staff).

## Batasan

Mengikuti batasan paket gratis (Vercel + Neon) untuk keperluan demonstrasi; bukan jaminan
kesiapan produksi. Lihat bagian "Deployment & Cost Constraints" pada `PRD.md`.
