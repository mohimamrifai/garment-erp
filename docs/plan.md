# Plan Pengerjaan Bertahap — Garment ERP

**Sumber:** `PRD.md` v1.1.0 (Approved for Implementation)
**Disusun:** 18 Oktober 2026 · **Diperbarui:** 24 Oktober 2026
**Status:** Selesai — termasuk HRIS, Payroll & Akuntansi
**Strategi:** Opsi 1 — urutan fase PRD + pola referensi (vertical slice) di Fase 1 + checkpoint demo di setiap fase

---

## 1. Keputusan yang sudah dikunci

| # | Topik | Keputusan | Alasan singkat |
|---|---|---|---|
| 1 | Arsitektur | Modular monolith Next.js App Router + TypeScript strict, satu repo | PRD §7 |
| 2 | Authentication | **Better Auth** — email+password, `disableSignUp` untuk publik, plugin `admin` untuk manajemen user | Auth.js kini dipelihara tim Better Auth & hanya security-patch |
| 3 | Authorization | Skema PRD: tabel `roles` + `user_roles` (multi-role). Identitas oleh Better Auth; otorisasi app-level via `requireAuth()` / `requireRole()` + matriks izin typed di `src/lib/permissions` | PRD §3, §6.1 |
| 4 | Database | PostgreSQL. Dev & tes: Docker lokal. Produksi: **Neon** (region Singapura bila tersedia) | Free tier tanpa kartu, branching, tooling MCP tersedia |
| 5 | ORM & migrasi | Drizzle ORM + Drizzle Kit (migrasi versioned di repo) | PRD §7.2 |
| 6 | Mutasi data | REST `/api/v1` (route handler tipis). Baca: service layer langsung dari Server Components | Konsisten, mudah diuji level HTTP |
| 7 | Validasi | Zod di semua boundary; schema dibagi client/server | PRD §7.2 |
| 8 | UI | Tailwind + shadcn/ui; DataTable pola shadcn + TanStack Table; Recharts | PRD §7.2 |
| 9 | Testing | Vitest (unit + integration, DB tes terpisah) + Playwright (E2E) — pragmatis-terarah | Fokus area risiko tinggi |
| 10 | Git | Conventional commits; tag `v0.1`–`v0.6` per checkpoint; repo GitHub | — |
| 11 | Dokumentasi | README Bahasa Indonesia + ringkasan Inggris singkat; `docs/plan.md` (salinan plan ini), `docs/api.md`, `docs/demo.md` | — |

---

## 2. Prinsip & aturan main (berlaku di semua fase)

1. **Checkpoint per fase:** aplikasi selalu bisa dijalankan; semua tes hijau; seed berfungsi; demo 3–5 menit; commit di-tag `v0.x`.
2. **Pola referensi:** vertical slice Buyer di Fase 1 (schema → Zod → repository → service → REST → UI → audit → tes). Modul baru wajib mengikuti pola ini kecuali ada alasan kuat yang dicatat.
3. **Lapisan:** route handler hanya `auth → Zod → service → respons`; seluruh aturan bisnis di service; akses DB di repository; UI tanpa aturan bisnis.
4. **Format API:** sukses `{ data, meta? }`; error `{ error: { code, message, details? } }` (detail validasi Zod di `details`).
5. **Integritas data:**
   - Operasi multi-tabel selalu dalam satu database transaction.
   - Semua perubahan stok **hanya** lewat inventory engine (dibangun di Fase 3). Modul lain dilarang menulis saldo langsung.
   - Satu sumber saldo: `inventory_balances` (material & barang jadi via `item_type`); `finished_goods` hanya catatan lot/traceability.
   - Dokumen bernomor via tabel `document_sequences` dalam tx yang sama (`SO-YYYYMM-####`, `PO-...`, `RCV-...`, `SPK-...`, `SJ-...`).
   - Waktu disimpan `timestamptz` UTC, ditampilkan Asia/Jakarta (util terpusat).
   - Aksi kritis menulis `audit_logs` dalam tx yang sama (`recordAudit(tx, ...)`).
   - Endpoint posting mendukung `idempotency_key` (UNIQUE) untuk mencegah penggandaan akibat request berulang.
6. **Testing minimum per fase:** unit untuk kalkulasi/aturan baru; integration untuk invarian baru; satu langkah E2E baru; negative/security test ditambahkan saat fiturnya dibuat. DB tes terpisah (`garment_erp_test`), migrasi programatik, reset antar suite.
7. **Skrip verifikasi:** `pnpm verify` = lint + typecheck + unit + integration — dijalankan sebelum setiap checkpoint.
8. **Enum status final** (keputusan awal; perubahan harus dicatat di `docs/changelog-requirements.md`):
   - Sales Order: `DRAFT → CONFIRMED → IN_PRODUCTION → READY_TO_SHIP → PARTIALLY_SHIPPED → COMPLETED`, plus `CANCELLED` (bersyarat).
   - Purchase Order: `DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED`, plus `CANCELLED` (bersyarat).
   - Material Receipt: `DRAFT → POSTED` (immutable), `CANCELLED` hanya untuk draft.
   - SPK: `OPEN → IN_PROGRESS → COMPLETED`, `CANCELLED` hanya sebelum material issue.
   - Stage produksi: `PENDING → IN_PROGRESS → COMPLETED`.
   - Hasil QC: `PENDING`, `PASS`, `FAIL`, `REWORK` (PRD).
   - Shipment: `DRAFT → POSTED` (update saldo SO saat posting), `CANCELLED` hanya draft.
   - SO `IN_PRODUCTION` di-set saat SPK pertama dibuat; `READY_TO_SHIP` saat barang jadi tersedia/dialokasikan.

---

## 3. Peta MCP & skill (sesuai permintaan)

| Alat | Pemakaian |
|---|---|
| **MCP context7** | Ambil dokumentasi terkini sebelum menulis modul: Better Auth v1.6+, Drizzle, Next.js App Router, shadcn/ui, TanStack Table, Recharts, Playwright. Wajib untuk fitur yang API-nya berubah cepat. |
| **MCP Neon** | F6: provisioning project/branch produksi, cek koneksi & schema, uji migrasi di branch. Opsional F1: smoke deploy. |
| **Skill `better-auth-best-practices`** | F1 — setup auth, session, plugin admin, pola role. |
| **Skill `postgres-drizzle`** | F1–F5 — schema, constraint, indeks, query, pooling, transaksi. |
| **Skill `next-best-practices`** | F1+ — RSC boundaries, route handlers, metadata, data patterns. |
| **Skill `shadcn`** | F1+ — komponen, DataTable, form, dialog. |
| **Skill `frontend-design` / `ui-ux-pro-max`** | F1 (shell dashboard), F5 (dashboard & laporan) — kualitas visual & UX. |
| **Skill `neon` / `neon-postgres` / `neon-postgres-branches`** | F6 — deployment DB, DATABASE_URL pooled vs direct, branch uji migrasi. |
| **Skill `web-design-guidelines`** | F6 — audit aksesibilitas & UX sebelum finalisasi. |
| **Skill `article-writing`** | F6 — polish README & dokumentasi portofolio. |

Catatan: gunakan alat di atas saat relevan; tidak wajib semuanya.

---

## 4. Estimasi

| Fase | Estimasi (hari kerja) |
|---|---|
| F1 Foundation & Pola Referensi | 5–6 |
| F2 Master Data & Sales | 5–7 |
| F3 Purchasing & Inventory | 5–7 |
| F4 Production & QC | 6–8 |
| F5 Finished Goods, Shipment & Reporting | 4–6 |
| F6 Release Readiness | 3–5 |
| F7 HRIS, Payroll & Accounting | 8–12 |
| **Total** | **36–51 hari kerja (±8 minggu kalender, rentang wajar 7–10 minggu)** |

Estimasi PRD (4–6 minggu) tetap relevan bila item bertanda *(opsional)* dilewati dan pengerjaan mendekati penuh waktu. Waktu sebenarnya bergantung pada kedalaman pengujian (PRD §10).

---

## 5. FASE 1 — Foundation & Pola Referensi

**Tujuan:** fondasi teknis + pola referensi yang akan dipakai semua modul berikutnya.

### Tasks

- [x] 1.1 Prasyarat: akun GitHub, Vercel, Neon (semua paket gratis, tanpa kartu — verifikasi saat signup); salin plan ini ke `docs/plan.md`; catat keputusan yang sudah dikunci di README (bagian Arsitektur).
- [x] 1.2 `git init`, `.gitignore`, `.editorconfig`, ESLint + Prettier, konvensi conventional commits, README skeleton.
- [x] 1.3 Scaffold Next.js App Router + TS strict (pnpm); buat struktur folder inti §7.4 (sebagian kosong); `.env.example` tanpa secret; pin versi di `package.json`.
- [x] 1.4 Tailwind + shadcn/ui init; tema dasar; komponen awal: button, input, select, table, dialog, dropdown, badge, sonner. Tema netral, teks UI Bahasa Indonesia.
- [x] 1.5 Docker Compose Postgres 16 (dev) + database tes `garment_erp_test`; Drizzle: `drizzle.config.ts`, client, skrip `db:generate` / `db:migrate` / `db:seed` / `db:reset`; CI GitHub Actions dasar (typecheck + unit).
- [x] 1.6 Skema database F1: tabel Better Auth (`user`, `session`, `account`, `verification`) + `roles` + `user_roles`; migrasi awal; seed 8 role (Admin, Manager, Sales, Purchasing, Warehouse, Production Supervisor, QC Staff, Shipping Staff).
- [x] 1.7 Better Auth: `auth.ts` (drizzleAdapter provider `"pg"`, `emailAndPassword` enabled + `disableSignUp: true`, plugin `admin`); halaman `(auth)/login` + logout; middleware proteksi route; helper `requireAuth()` / `requireRole()`; matriks izin typed.
- [x] 1.8 Manajemen user (settings, admin-only): daftar user, buat user tanpa registrasi publik, aktif/nonaktifkan, tetapkan multi-role; semua aksi diaudit.
- [x] 1.9 Layout dashboard: shell (sidebar per role, header, breadcrumb, menu modul), route placeholder per modul, redirect `/` → `/dashboard`.
- [x] 1.10 Komponen & util shared: helper format error API, zod→API error mapping, DataTable (sort/filter/paginate server-side), FormField wrapper (RHF + zodResolver), ConfirmDialog, StatusBadge, util waktu (UTC → Asia/Jakarta), util angka/IDR, helper penomoran dokumen (`document_sequences` + `nextDocumentNumber(tx, prefix, period)`).
- [x] 1.11 Audit log: tabel `audit_logs` + `recordAudit(tx, {...})`.
- [x] 1.12 **Vertical slice Buyer (pola referensi):** schema + Zod + repository + service; `/api/v1/buyers` (GET list paginate, POST, PATCH, POST deaktivasi); UI list + form; RBAC (Admin/Manager/Sales); audit; tes: unit 2–3, integration 2 (create + audit, list paginate), e2e 1 (login admin → buat buyer → tampil di list).
- [x] 1.13 Seed dev dasar + akun admin; README awal (setup lokal, akun seed).
- [x] 1.14 *(Opsional, ±0,5 hari)* Smoke deploy Vercel + Neon satu halaman — validasi pipeline & env lebih awal. — ✅ 19 Okt 2026: https://garment-erp-olive.vercel.app (Vercel region `sin1` + Neon Singapore pg18; repo GitHub tersambung untuk auto-deploy; login & API terverifikasi di produksi).
- [x] 1.15 Design system "Pabrik" (dikerjakan setelah deploy, sebelum F2): retokn penuh token & UI — IBM Plex Sans/Mono, netral warm-graphite + satu aksen oranye industri, radius kecil (5px tag / 8px kontrol), tabel padat, sidebar graphite gelap di kedua mode, tema terang/gelap + toggle; semua halaman existing (login, shell, dashboard, tabel) memakai sistem ini. Dokumentasi: `docs/design-system.md`. — ✅ 19 Okt 2026.

### Definisi selesai F1
- 8 role dapat login/logout; route & API terlindungi menolak akses tak berizin (dites).
- CRUD Buyer lengkap via REST + UI dengan validasi server; audit tercatat; pagination berjalan.
- `pnpm verify` hijau; E2E pertama lulus; demo 3 menit.

**Checkpoint: tag `v0.1`.**

---

## 6. FASE 2 — Master Data & Sales

**Tujuan:** seluruh master data PRD + modul Sales Order berfungsi penuh.

### Tasks

- [x] 2.1 Master data organisasi: `departments`, `employees` (dasar: kode, nama, departemen, jabatan, status), `production_lines` — CRUD pola referensi.
- [x] 2.2 `suppliers` CRUD; `units_of_measure` CRUD; `materials` CRUD (satuan, `minimum_stock`).
- [x] 2.3 `products` + `product_variants` CRUD (size/color, SKU unik per varian).
- [x] 2.4 `warehouses` + `warehouse_locations` CRUD (UNIQUE (warehouse, code)).
- [x] 2.5 Guard master data: nonaktifkan (`is_active`) alih-alih hapus bila sudah dipakai transaksi; validasi di service + tes. — ✅ 19 Okt 2026: departemen↔karyawan aktif, satuan↔material aktif, material↔BOM aktif, produk/varian↔BOM aktif & SO terbuka, buyer↔SO aktif, gudang↔lokasi aktif; semuanya diuji integration.
- [x] 2.6 BOM: `bills_of_materials` + `bom_items`; editor per varian; versi baru + aktivasi; UNIQUE (variant, version) & (bom, material); siapkan aturan "BOM terpakai SPK tidak dapat diubah" (aktif di Fase 4). — ✅ 19 Okt 2026: satu versi aktif per varian (aktivasi mengnonaktifkan versi lama + `effective_until`); BOM aktif beku — revisi lewat "versi baru" yang menyalin item; hook guard SPK ditandai di service untuk Fase 4.
- [x] 2.7 Sales Order: modul sales — create DRAFT multi-item (varian, qty > 0, harga ≥ 0, due date), edit draft; penomoran `SO-YYYYMM-####`; transisi DRAFT → CONFIRMED; cancel bersyarat + alasan; list/detail/filter/search; query saldo pesanan (terpesan, terkirim, sisa).
- [x] 2.8 RBAC tiap layar & aksi sesuai matriks (Sales: buyer + SO; Purchasing: supplier; Admin/Manager: master data; role lain read-only bila diizinkan).
- [x] 2.9 Dashboard ringan: kartu SO aktif & mendekati tenggat dari data nyata (diperluas penuh di Fase 5).
- [x] 2.10 Tes: unit (transisi status SO, penomoran, guard nonaktif/hapus), integration (guard confirm, nonaktifkan data terpakai), e2e (buat SO → confirm). — ✅ 19 Okt 2026: unit 35 (termasuk transisi status & validasi form SO), integration 23 (SO create/confirm/cancel, guard data terpakai, BOM, ringkasan dashboard), e2e SO (buat → konfirmasi → batal).

### Definisi selesai F2
- SO lengkap bisa dibuat → diedit (draft) → dikonfirmasi → dibatalkan sesuai aturan; tidak ada transisi liar (dites).
- Master data lengkap dengan guard; data terpakai tidak bisa dihapus.

**Checkpoint: tag `v0.2`.**

---

## 7. FASE 3 — Purchasing & Inventory

**Tujuan:** tulang punggung sistem — inventory engine — plus purchasing dan seluruh operasi stok.

### Tasks

- [x] 3.1 **Inventory engine (kritikal):** skema `inventory_balances` + `inventory_transactions`; `item_type` discriminator + CHECK tepat satu FK terisi; `quantity_on_hand ≥ 0`, `quantity_reserved ≥ 0`; UNIQUE (item, lokasi). Fungsi `postMovement()` dalam satu DB tx: lock baris (`SELECT ... FOR UPDATE`), validasi saldo cukup, insert transaksi immutable, update balance; mendukung receipt/issue/transfer/adjustment/reservation; `idempotency_key` UNIQUE. — ✅ 19 Okt 2026: `src/modules/inventory/engine.ts` — validasi bentuk murni + efek murni (satuan skala 1e-4), lock `FOR UPDATE` urut lokasi (anti-deadlock), idempotency dicek sebelum/sesudah lock + fallback unique-violation (pengulangan mengembalikan transaksi lama), transaksi immutable dengan CHECK bentuk per tipe; guard: stok tidak negatif, issue/transfer tidak memakan stok reserved, reservasi ≤ tersedia.
- [x] 3.2 Tes engine (dibuat bersama engine, bukan menyusul): unit (aritmetika, aturan); integration — receipt menambah stok; issue menolak saldo kurang; transfer atomik dua sisi; adjustment tercatat; request berulang idempotent tidak menggandakan; saldo tidak bisa negatif. — ✅ 19 Okt 2026: unit 56 (6 file, termasuk engine + transisi PO); integration 47 (4 file) — termasuk backstop CHECK DB, idempotency, reservasi, dan integritas transfer atomik.
- [x] 3.3 Purchase Order: `purchase_orders` + items; create/edit DRAFT (supplier, material, qty, harga, tanggal, expected date); transisi DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED + cancel bersyarat; penomoran `PO-...`; list/detail/filter. — ✅ 19 Okt 2026: edit hanya DRAFT (item diganti utuh); cancel DRAFT/ORDERED dengan alasan, diblokir setelah ada penerimaan; status parsial/lengkap dihitung dari penerimaan terposting.
- [x] 3.4 Material Receipt: `material_receipts` + items; dari PO (parsial diperbolehkan); guard total diterima ≤ ordered (tanpa toleransi); posting atomik via engine (stok naik) + idempotency; update status PO; penomoran `RCV-...`; UI receipt + riwayat per PO. — ✅ 19 Okt 2026: lokasi tujuan per dokumen; yang dihitung hanya qty "diterima baik" (accepted) saat POSTED; over-receipt ditolak saat create (vs sisa terposting) dan sekali lagi ketat saat posting; dokumen POSTED immutable; cancel hanya DRAFT.
- [x] 3.5 Inventory UI — saldo: list per lokasi/material/warehouse + filter; badge minimum stock; tampilan reserved. — ✅ 19 Okt 2026: `/inventory` dengan filter gudang/lokasi/tipe item/stok-minimum + pencarian; kartu peringatan jumlah material di bawah minimum.
- [x] 3.6 Inventory UI — mutasi: riwayat transaksi (filter tipe/tanggal/item/lokasi) + detail dengan referensi dokumen. — ✅ 19 Okt 2026: `/inventory/movements` — filter tipe/item/lokasi + rentang tanggal, arah kuantitas per tipe, referensi dokumen & catatan, petugas.
- [x] 3.7 Inventory UI — transfer antar lokasi: validasi saldo asal, atomik, berjejak. — ✅ 19 Okt 2026: dialog di halaman inventori; kunci idempotensi per pembukaan dialog (retry aman).
- [x] 3.8 Inventory UI — penyesuaian stok: qty +/−, alasan wajib, audit; tidak ada jalur lain yang mengubah stok. — ✅ 19 Okt 2026: dialog arah masuk/keluar + alasan wajib; alasan masuk notes transaksi & audit log.
- [x] 3.9 RBAC Warehouse & Purchasing; menu inventory per role. — ✅ 19 Okt 2026: `po.*`, `receipt.*`, `inventory.*` di matriks izin; menu "Pembelian & Gudang" (Pembelian, Penerimaan, Inventori, Mutasi Stok); supervisor produksi dapat melihat stok tanpa hak mengubah.
- [x] 3.10 E2E: PO → receipt via UI → saldo bertambah; transfer via UI. — ✅ 19 Okt 2026: `tests/e2e/purchasing.spec.ts` — (1) purchasing: PO draf → pesan → terima → posting → mutasi tercatat & PO lengkap; (2) filter daftar PO; (3) gudang: transfer + penyesuaian dari halaman inventori.

### Definisi selesai F3
- PO → receipt → saldo konsisten; transfer/adjustment atomik & berjejak; stok negatif mustahil (dijaga DB + service, dites); endpoint posting anti penggandaan.

**Checkpoint: tag `v0.3`.**

---

## 8. FASE 4 — Production & QC

**Tujuan:** produksi berjalan dari SO sampai barang siap QC, dengan kontrol kuantitas ketat.

### Tasks

- [x] 4.1 Material planning: kalkulasi bruto/bersih (rumus PRD FR-07: cadangan opsional, stok tersedia, penerimaan terjadwal yang dapat diperhitungkan); API read; UI tabel per SO item/SPK (kebutuhan, tersedia, teralokasi, terjadwal, kekurangan, saran beli); tombol "buat PO" prefill dari kekurangan. — ✅ 19 Okt 2026: `computeMaterialRequirement` (murni, diuji): bruto = qty × konsumsi/unit, cadangan = qty × scrap/unit, bersih = maks(0, bruto + cadangan − tersedia − terjadwal). Terjadwal = sisa PO berjalan (ordered − accepted terposting) dengan `expected_date ≤ needBy` (tanpa tanggal dihitung); tersedia = saldo on-hand − reserved. API `GET /api/v1/production/planning?soItem=&quantity=&needBy=`; UI tabel di `/production/new` (preview) dan detail SPK; tombol "Buat PO dari Kekurangan" → `/purchasing/new?spk=<id>` dengan banner & item prefill.
- [x] 4.2 Gate ketersediaan sebelum SPK: tampilkan status cukup/kurang; keputusan jalan oleh supervisor tercatat. — ✅ 19 Okt 2026: status "Material cukup"/"Material kurang (n item)" dari preview; submit diblokir saat kurang tanpa alasan; `POST /api/v1/production-orders` mengulang perhitungan penuh (bukan percaya UI) — kekurangan tanpa `shortageReason` ditolak 409, dan alasan tercatat di kolom SPK + tampil sebagai banner peringatan di detail.
- [x] 4.3 SPK (`production_orders`): create dari SO item terkonfirmasi (varian, target qty, lini, tanggal, BOM terpilih → BOM terkunci); auto-generate 4 `production_stages` (cutting, sewing, finishing, packing); penomoran `SPK-...`; list/detail; status OPEN → IN_PROGRESS → COMPLETED; set SO `IN_PRODUCTION` saat SPK pertama dibuat. — ✅ 19 Okt 2026: guard: SO `CONFIRMED`/`IN_PRODUCTION` (baris dikunci `FOR UPDATE`), target ≤ sisa item − Σ SPK non-cancelled, BOM aktif wajib (terkunci via `bom_id`), lini aktif; 4 tahap target = target qty; status SPK dihitung dari status tahap (semua PENDING = Terbuka, semua COMPLETED = Selesai); cancel hanya saat Terbuka & tanpa catatan (SO kembali Terkonfirmasi bila tak ada SPK lain); list filter status + pencarian, detail lengkap.
- [x] 4.4 Pencatatan output tahap (`production_records`): form per tahap (processed/passed/rejected, notes, petugas, waktu); guard: processed ≤ tersedia dari tahap sebelumnya (tahap 1 = target), passed + rejected = processed, tidak negatif; update status stage/SPK. — ✅ 19 Okt 2026: `validateStageRecordInput` + output tersedia = input tahap (target untuk cutting; total lolos tahap sebelumnya untuk sisanya) + jatah rework; dicatat dalam satu tx dengan kalkulasi ulang status tahap → status SPK; petugas & waktu tersimpan.
- [x] 4.5 Material issue ke produksi: form pemakaian (prefill BOM × qty, dapat disesuaikan dengan alasan), via inventory engine; validasi stok; tercatat per SPK; audit. — ✅ 19 Okt 2026: `material_issues` + items, penomoran `MIS-...`; quantity prefill = bruto + cadangan BOM − pemakaian sebelumnya; semua item wajib dari BOM SPK; posting `ISSUE` via `postMovement` dalam tx yang sama (referenceType `material-issue`); idempotency key di dialog + fallback unique-violation; audit `production.issue`.
- [x] 4.6 QC (`qc_inspections` + `qc_defects`): inspeksi per tahap (terutama finishing/packing); inspected/passed/rejected + detail defect (kode + kuantitas); result PENDING/PASS/FAIL/REWORK; guard kuantitas (passed + rejected ≤ inspected); UI inspeksi + riwayat. — ✅ 19 Okt 2026: penomoran `QC-...`; guard: diperiksa ≤ sisa output lolos tahap (total inspeksi top-level), hasil REWORK wajib cacat > 0, Σ qty rincian cacat ≤ cacat, kode cacat unik (Zod); audit; UI list (filter hasil/tahap + pencarian) dan detail dengan rincian cacat + riwayat tindak lanjut; tabel inspeksi tampil di kartu tahap SPK.
- [x] 4.7 Rework: inspeksi ulang = record baru dengan `parent_inspection_id`; kembali ke tahap terkait; tanpa menggandakan output; UI tindak lanjut. — ✅ 19 Okt 2026: inspeksi ulang `parent_inspection_id` dibatasi Σ diperiksa anak < cacat induk (tanpa penggandaan); inspeksi REWORK membuka jatah rework tahap; `production_records.is_rework` mencatat pemrosesan ulang (jatah = Σ cacat inspeksi REWORK − Σ diproses rework) tanpa mengubah cap normal dari output lolos sebelumnya; link "Inspeksi Ulang" dari detail QC + tombol "Inspeksi QC" di kartu tahap.
- [x] 4.8 Tes: unit (rumus planning, guard kuantitas antar-tahap, guard QC), integration (output stage guard, rework no double-count, issue material via engine), e2e (jalankan SPK 1 tahap + 1 inspeksi). — ✅ 19 Okt 2026: unit 73 total (17 baru: label/alur, pembatalan, kapasitas, status tahap & SPK, rumus FR-07, batas QC); integration 57 total (10 baru: SPK + 4 tahap + BOM terkunci + SO → Dalam Produksi, over-plan/SO draf/tanpa BOM, gate keputusan supervisor, batas output antar-tahap, alur rework tanpa double count, batas inspeksi & rincian cacat, pemakaian via engine + idempotensi + stok kurang, cancel & kembalinya SO, sisa inspeksi); e2e `tests/e2e/production.spec.ts` (daftar SPK/QC + filter, alur UI penuh: SO → SPK (gate cukup) → output cutting → pemakaian → inspeksi QC lolos).

### Definisi selesai F4
- Satu SPK berjalan cutting → packing; output tak bisa melebihi input tahap sebelumnya (dites); QC + rework tercatat tanpa menggandakan jumlah; pemakaian material mengurangi stok konsisten.

**Checkpoint: tag `v0.4`.**

---

## 9. FASE 5 — Finished Goods, Shipment & Reporting

**Tujuan:** menutup rantai order-to-shipment + dashboard penuh + laporan.

### Tasks

- [x] 5.1 Barang jadi dari QC akhir: catatan lot `finished_goods` (varian, lokasi, SPK, inspeksi QC, qty) + masuk saldo via engine (`item_type` = FG). Satu sumber saldo; lot hanya untuk traceability — didokumentasikan di README. — ✅ 19 Okt 2026: hook otomatis saat inspeksi **PASS** tahap packing (`fg:<inspectionId>` idempoten, satu lot per inspeksi via UNIQUE); lokasi FG mengikuti konvensi `B-01` → nama mengandung "produk jadi" → lokasi aktif pertama; UI dokumentasi di README.
- [x] 5.2 UI stok barang jadi per varian/lokasi; guard: belum lolos QC akhir tidak dapat dialokasikan/dikirim. — ✅ 19 Okt 2026: `/finished-goods` (ringkasan fisik/tersedia/varian, filter gudang, tabel saldo + lot terbaru bertaut SPK & QC); alokasi hanya membaca saldo FG dari engine sehingga barang tanpa QC akhir tidak pernah masuk.
- [x] 5.3 Alokasi/reservasi FG ke SO item (reserved + pelepasan); tampilkan saldo tersedia; set SO `READY_TO_SHIP` bila layak. — ✅ 19 Okt 2026: ledger alokasi diturunkan dari transaksi engine `so-allocation` (RESERVE − UNRESERVE per item/lokasi); endpoint alokasi & pelepasan; status SO dihitung ulang (siap kirim bila seluruh sisa tertutup, kembali ke produksi/konfirmasi bila alokasi dilepas); form alokasi/pelepasan di detail SO.
- [x] 5.4 Shipment (`shipments` + items): create dari SO (parsial diperbolehkan); guard: ≤ saldo item pesanan dan ≤ FG tersedia; posting atomik via engine + idempotency; penomoran `SJ-...`; status SO `PARTIALLY_SHIPPED` / `COMPLETED`; riwayat pemenuhan di detail SO. — ✅ 19 Okt 2026: draf → posting (guard ketat dihitung ulang saat posting: sisa pesanan vs stok tersedia + alokasi item di lokasi), posting melepas reservasi lalu `ISSUE` FG dalam satu tx; pembatalan hanya draf; detail SJ, daftar/filter, riwayat SJ di detail SO; tanpa kolom idempotensi dokumen (kunci engine + guard status).
- [x] 5.5 Dashboard penuh (FR-02): SO aktif, produksi berjalan, mendekati tenggat, material < minimum, output per periode, defect rate, FG & pengiriman; filter periode; Recharts; query agregasi efisien + indeks. — ✅ 19 Okt 2026: kartu F1–F4 tetap + kartu "Barang Jadi & Pengiriman" (stok tersedia, output packing, defect rate, kiriman bulan berjalan) dengan filter 7/30/90 hari dan grafik batang Recharts (output vs cacat harian); agregasi SQL langsung, bukan N+1.
- [x] 5.6 Reporting (FR-11): 7 laporan (SO & pemenuhan, PO & penerimaan, stok & mutasi, output per tahap, target vs aktual, QC & defect rate, FG & pengiriman) + filter periode + scoping role. — ✅ 19 Okt 2026: satu `buildReport(slug, periode)` untuk 7 laporan; periode default 30 hari; tab laporan difilter per role (mis. purchasing hanya PO/penerimaan, QC hanya QC, shipping hanya FG/pengiriman).
- [x] 5.7 Ekspor CSV: util server-side + endpoint ekspor per laporan. — ✅ 19 Okt 2026: `toCsv` dengan escaping RFC 4180 + BOM UTF-8; `GET /api/v1/reports/export?report=&from=&to=` mengembalikan CSV unduhan; kolom sama dengan tabel layar.
- [x] 5.8 Tes: unit (defect rate, attainment, saldo pesanan), integration (guard shipment, konsistensi sumber saldo FG), e2e (alur penuh order-to-shipment versi pas). — ✅ 19 Okt 2026: unit 87 total (defect rate, attainment, transisi status pemenuhan, batas kirim, alokasi); integration 62 total (lot FG dari packing PASS tanpa double count, alokasi/pelepasan, guard ≤ sisa & ≤ stok, posting sekali + konsumsi alokasi, batal draf, pembatalan SO melepas alokasi); e2e `tests/e2e/shipping.spec.ts` (SO → SPK → 4 output → QC packing → FG → alokasi → SJ → posting → laporan).

### Definisi selesai F5
- Alur SO → SPK → QC → FG → Shipment selesai dari UI tanpa manipulasi DB; SO `COMPLETED` saat kuantitas wajib terpenuhi; dashboard & laporan memakai data aktual; CSV benar.

**Checkpoint: tag `v0.5`.**

---

## 10. FASE 6 — Release Readiness

**Tujuan:** MVP siap dipresentasikan sesuai acceptance criteria PRD §12.

### Tasks

- [x] 6.1 E2E suite lengkap: login tiap role, akses ditolak, alur penuh order-to-shipment, manajemen user.
  - `roles.spec.ts` (login + menu + halaman diizinkan + `/akses-ditolak` untuk **8 role**), `users.spec.ts`
    (buat → nonaktifkan → akun tertolak → aktifkan → login; larangan nonaktifkan diri; audit log),
    `shipping.spec.ts` (order-to-shipment penuh). Total **37 E2E lulus** terhadap build produksi.
- [x] 6.2 Security negative tests: tanpa sesi → 401; manipulasi ID (IDOR) ditolak; kuantitas negatif/invalid ditolak; double submit idempotent; akses lintas role ditolak.
  - `security.spec.ts`: 8 skenario (401 tanpa sesi, 403 lintas role, 422 kuantitas negatif/nol/pecahan &
    item kosong, 409 melebihi sisa & posting ganda, 404 ID non-UUID/tidak ada, 400 item dokumen lain,
    idempotensi transfer stok).
- [x] 6.3 Audit otorisasi menyeluruh: inventaris semua endpoint & halaman vs matriks izin; tutup celah; uji ulang.
  - Inventaris **67 route API + 41 halaman** vs matriks izin; temuan: (a) ID non-UUID → 500 (diperbaiki jadi
    404 di `handleApiError`, sadar pembungkus error Drizzle), (b) permission `audit.view` tanpa pemakai →
    halaman `/settings/audit` + `GET /api/v1/audit-logs` (M11), (c) guard izin dievaluasi sebelum validasi body
    (terverifikasi lewat uji 403 dengan body kosong). Rincian di `docs/security-review.md`.
- [x] 6.4 Security review ringkas: secrets hanya di env; `.gitignore`; pesan error tidak membocorkan info; setelan cookie/session; catat hasil.
  - `docs/security-review.md` §3: secrets env-only, `.env*` ter-ignore, error seragam tanpa stack/query,
    cookie `HttpOnly; SameSite=Lax; Secure` (HTTPS) 7 hari, rate limit aktif di produksi; ditambah header
    keamanan (`nosniff`, `DENY`, HSTS, dll.) + `poweredByHeader: false`; verifikasi `curl` tercatat.
- [x] 6.5 Seed demo lengkap + realistis: master data, SO lintas status, PO, produksi berjalan, QC, FG, shipment; 8 akun demo (satu per role) — didokumentasikan di README; `docs/demo.md` berisi skenario demo.
  - Seed diperluas: **6 status SO** (Draf, Dalam Produksi, Siap Kirim, Terikirim Sebagian, Selesai,
    Dibatalkan) dengan 2 surat jalan POSTED (satu pesanan selesai penuh, satu parsial), 5 PO, 3 SPK
    (termasuk riwayat rework), 6 QC, lot & saldo FG; 8 akun demo; `docs/demo.md` + akun di README.
- [x] 6.6 Neon produksi: project + region Singapura; pooled & direct connection; jalankan migrasi + seed; (gunakan Neon MCP).
  - Project `young-field-23383019` (free tier), region Singapura; `DATABASE_URL` pooled untuk runtime Vercel,
    direct untuk migrasi/seed; migrasi + seed dijalankan dari nol pada database produksi (via build command
    sementara) dan terverifikasi lewat API produksi.
- [x] 6.7 Vercel: deploy + env vars (pooled untuk runtime, direct untuk migrasi); smoke test publik.
  - Deploy `dpl_69QWNPGmmkVofqvhHMSrdZGppNCA` → https://garment-erp-olive.vercel.app (region `sin1`);
    env: `DATABASE_URL` pooled, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_DEMO_MODE=1`;
    smoke test 10 halaman 200, login + cookie, API data, CSV, 401/404, header keamanan (tabel di `docs/acceptance.md` §11).
- [x] 6.8 README final: setup, arsitektur, alur bisnis, akun demo, ekspor CSV, batasan paket gratis + ringkasan Inggris singkat; screenshot/GIF portofolio.
  - README ditulis ulang (demo + screenshot, status F1–F6, alur bisnis, testing, deployment, batasan,
    ringkasan Inggris); **13 screenshot** di `docs/screenshots/` diregenerasi via `scripts/capture-screenshots.mjs`.
- [x] 6.9 `docs/api.md`: daftar endpoint + contoh request/response.
  - `docs/api.md`: konvensi, tabel kode error, contoh auth, seluruh endpoint per modul (67 route) beserta
    izin, contoh request/response, aturan bisnis, catatan implementasi.
- [x] 6.10 Verifikasi checklist acceptance PRD §12 satu per satu; catat bukti; perbaiki yang gagal.
  - `docs/acceptance.md`: 12/12 butir terpenuhi dengan bukti; perbaikan yang ditemukan saat verifikasi:
    bug `pnpm db:reset` (jejak migrasi Drizzle tidak ikut dihapus sehingga migrasi dari nol dilewati) —
    diperbaiki + diverifikasi; halaman audit log ditambahkan untuk M11.
- [x] 6.11 Tag `v1.0`; catat backlog post-MVP.
  - Tag `v1.0` pada commit rilis; kandidat pasca-MVP dicatat di `docs/backlog.md`.

### Definisi selesai F6
- Seluruh checklist §12 tercentang; demo publik hidup dan bisa dinavigasi per role.

**Checkpoint: tag `v1.0` = MVP selesai.**

---

## 11. FASE 7 — HRIS, Payroll & Accounting (penambahan final)

**Tujuan:** menutup kebutuhan back-office sebagai modul final: kepegawaian, payroll bulanan,
akuntansi double-entry, dan laporan keuangan SAK EMKM sederhana.

### Tasks

- [x] 7.1 Schema HRIS & payroll: perluasan `employees` (gaji, pajak, BPJS, bank, kontrak),
  `attendance_records`, `leave_types`, `leave_requests`, `payroll_runs`, `payslips`.
  Migrasi `drizzle/0006_organic_serpent_society.sql`.
- [x] 7.2 Schema akuntansi: `accounts`, `account_mappings`, `accounting_settings`,
  `fiscal_periods`, `journal_entries`, `journal_lines`, `sales_invoices`, `purchase_bills`,
  `payments`, `inventory_costs`.
- [x] 7.3 Service HR: absensi unik per karyawan/tanggal, cuti dengan validasi tumpang tindih,
  kuota, dan status; seed jenis cuti default lewat `ensureLeaveTypes`.
- [x] 7.4 Kalkulator payroll: gaji pokok, tunjangan, lembur (divisor 173), potongan
  ketidakhadiran/cuti tidak dibayar, BPJS Kesehatan/JHT/JP/JKK/JKM, PTKP, dan PPh 21 progresif.
- [x] 7.5 Siklus payroll: `DRAFT → APPROVED → PAID`/`CANCELLED`, slip gaji, posting jurnal
  otomatis saat persetujuan, pembayaran lewat kas/bank.
- [x] 7.6 Akuntansi inti: COA + mapping, jurnal immutable, idempotensi
  `source_type + source_id + source_event`, jurnal pembalik, periode fiskal, tutup buku.
- [x] 7.7 Integrasi otomatis: penerimaan material → tagihan + jurnal; pengiriman → faktur +
  HPP + jurnal; payroll → jurnal beban/kewajiban; pembayaran → jurnal kas/bank.
- [x] 7.8 Laporan: neraca saldo, laba rugi, neraca, buku besar, arus kas, umur piutang,
  umur utang, dan rekap payroll; ekspor CSV mengikuti mesin laporan yang ada.
- [x] 7.9 UI: halaman HR (absensi, cuti), payroll (daftar, detail, aksi), akuntansi
  (dashboard, COA, jurnal, kas/bank, tutup buku, laporan keuangan).
- [x] 7.10 Role & navigasi: `HR_STAFF`, `PAYROLL_ADMIN`, `FINANCE_STAFF`; quick login demo
  tetap 8 akun, akun tambahan di-seed tanpa tombol masuk cepat.
- [x] 7.11 Seed & backfill: data absensi/cuti/payroll contoh, akun COA tambahan, dan
  `scripts/backfill-accounting.ts` untuk data produksi lama.
- [x] 7.12 Pengujian: unit kalkulasi payroll, integration akuntansi/HR/payroll, E2E halaman
  dan pembatasan role baru.
- [x] 7.13 Dokumentasi: PRD, plan, API, demo, acceptance, README, dan panduan role `/docs`.

### Definisi selesai F7
- Payroll bulanan dapat dihitung, disetujui, dibayar, dan dijurnal tanpa intervensi SQL.
- Laporan keuangan seimbang; jurnal tidak dapat diubah/dihapus; koreksi memakai pembalik.
- Role baru tidak dapat membuka modul di luar izinnya; quick login tetap 8 akun.
- `pnpm verify`, `pnpm build`, dan `pnpm test:e2e` lulus.

**Checkpoint: tag `v1.1` = proyek final (ERP operasional + back-office).**

### Keputusan yang masih terbuka
- Pembagian final role HR vs Payroll vs Finance (implementasi memakai pemisahan saat ini).
- Kebijakan pajak/BPJS detail (tarif default dapat dikonfigurasi; belum menggantikan konsultan pajak).

---

## 12. Risiko & mitigasi

| # | Risiko | Mitigasi |
|---|---|---|
| 1 | Scope creep (fitur "enak ditambah") | Cakupan tiap fase dikunci di plan ini; tambahan masuk `docs/backlog.md` (aturan perubahan scope §13) |
| 2 | Bug invarian stok/produksi baru ketahuan terlambat | Engine + tesnya dibangun bersama di F3; check constraint DB + guard service; idempotency; tes integration per invarian |
| 3 | Rework QC menggandakan hitungan | Model `parent_inspection_id` + lot; tes khusus no double-count di F4 |
| 4 | BOM berubah setelah dipakai SPK | BOM terkunci saat terpakai; SPK menyimpan `bom_id` historis (PRD §6.3) |
| 5 | Batas/pause free tier (Neon scale-to-zero, kuota Vercel) | Verifikasi kuota saat mulai & F6; warm-up sebelum demo; batasan didokumentasikan di README |
| 6 | Skema auth Better Auth vs tabel users PRD | Pemetaan eksplisit: Better Auth = identitas; `roles`/`user_roles` = otorisasi; didokumentasikan di README arsitektur |
| 7 | Estimasi melar | Checkpoint per fase; item *(opsional)* dipotong lebih dulu; prioritas P0 dijaga |
| 8 | Bug zona waktu/angka | Util terpusat sejak F1 + tes |

---

## 13. Definisi proyek selesai (ringkas PRD §2.3 & §12)

Pengguna dapat menyelesaikan **Sales Order → Material Planning → Purchasing → Material Receipt → Production → QC → Finished Goods → Shipment → Reporting** dan **Karyawan → Absensi/Cuti → Payroll → Jurnal → Laporan Keuangan** tanpa manipulasi database manual; semua perubahan konsisten & tertelusur; RBAC aktif di semua operasi; dashboard dari data aktual; audit log merekam aksi penting; unit/integration/E2E alur kritis lulus; migrasi bisa dijalankan dari nol; seed demo realistis; deployment hidup; README lengkap.

---

## 14. Aturan perubahan scope

Setelah implementasi dimulai, perubahan scope dicatat di `docs/changelog-requirements.md` beserta dampaknya terhadap database, API, pengujian, dan jadwal (mengikuti penutup PRD). Perubahan besar dijadwalkan sebagai fase terpisah, bukan disisipkan diam-diam.
