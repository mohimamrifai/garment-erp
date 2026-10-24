# Verifikasi Acceptance Criteria — PRD §12

Tanggal verifikasi: 24 Oktober 2026 · Versi: **v1.1** · Lingkungan: lokal (build produksi
`next start`) + deployment demo Vercel/Neon.

Cara menjalankan ulang seluruh bukti:

```bash
pnpm verify        # typegen + lint + typecheck + unit + integration
pnpm build
pnpm test:e2e      # Playwright terhadap build produksi
```

Hasil terakhir: **125 unit ✓ · 70 integration ✓ · 47 E2E ✓** (lihat §8).

---

## 1. Semua modul P0 tersedia dan berfungsi

| Kode | Modul | Implementasi | Bukti |
|---|---|---|---|
| M01 | Authentication & RBAC | Better Auth + `roles`/`user_roles` + matriks izin terketik | `roles.spec.ts` (8 role quick login), `finance.spec.ts` (3 role back-office), `security.spec.ts` (401/403), `docs/security-review.md` |
| M02 | Dashboard | `src/modules/dashboard` (KPI periode 7/30/90 hari, grafik output) | `/dashboard` 200 di produksi; screenshot `docs/screenshots/02-dashboard.png` |
| M03 | Master Data | Buyer, supplier, produk+varian, material, BOM berversi, gudang+lokasi, satuan, organisasi | Halaman `/buyers`, `/master/*`; `buyer.spec.ts`; halaman ter-guard |
| M04 | Sales Order | Draf → konfirmasi → pemenuhan; penomoran `SO-YYYYMM-####` | `sales-order.spec.ts`; detail pemenuhan & alokasi |
| M05 | Purchasing | PO (draf → dipesan → diterima sebagian/lengkap) + penerimaan material | `purchasing.spec.ts`; integrasi siklus PO |
| M06 | Inventory | Inventory engine (transaksi immutable + idempotensi), saldo, transfer, penyesuaian | `inventory.test.ts` (10 tes); CHECK constraint DB |
| M07 | Production Management | SPK 4 tahap, output per tahap, pemakaian material, material planning | `production.spec.ts`; integrasi output & pemakaian |
| M08 | Quality Control | Inspeksi per tahap, cacat, rework ber-`parent_inspection_id` | `production.spec.ts`; integrasi lot FG dari QC packing |
| M09 | Finished Goods & Shipment | Lot FG, alokasi/reservasi, surat jalan draf → posting | `shipping.spec.ts` (order-to-shipment penuh) |
| M10 | Reporting | 15 laporan (7 operasional + 8 keuangan) + ekspor CSV | E2E unduh CSV; `accounting.test.ts`; `/accounting/reports` |
| M11 | Audit Log | `recordAudit(tx, ...)` di setiap mutasi + halaman read-only `/settings/audit` | `users.spec.ts` audit test; audit payroll/jurnal |
| M12 | HRIS | Karyawan, kontrak, absensi, cuti, jenis cuti | `hr.test.ts` (2 tes); `finance.spec.ts`; `/hr/*` |
| M13 | Payroll | Payroll bulanan, BPJS, PPh 21, slip gaji, approval, payment | `payroll-calc.test.ts` (6 tes); `payroll.test.ts`; `/payroll` |
| M14 | Accounting | COA, jurnal immutable, AR/AP, kas/bank, periode, tutup buku, laporan | `accounting.test.ts` (3 tes); `finance.spec.ts`; `/accounting/*` |

## 2. Alur order-to-shipment berhasil diuji dari awal sampai akhir

- E2E `tests/e2e/shipping.spec.ts` › *"order-to-shipment: QC akhir, alokasi, surat jalan, dan
  laporan"* — dari QC packing PASS → lot barang jadi → alokasi → surat jalan → posting →
  verifikasi stok & laporan operasional + CSV.
- Dilengkapi `purchasing.spec.ts` (PO → pesan → terima → posting stok) dan `production.spec.ts`
  (SPK → output tahap → pemakaian material → QC).
- Alur back-office diuji terpisah: `hr.test.ts` (absensi/cuti), `payroll.test.ts`
  (buat → setujui → bayar → jurnal), `accounting.test.ts` (jurnal → posting → pembalik →
  tutup buku → laporan keuangan), dan `finance.spec.ts` (halaman + pembatasan role).

## 3. Data stok konsisten dengan transaksi mutasi

- Satu-satunya jalur perubahan saldo: **inventory engine** (`src/modules/inventory/engine.ts`) —
  transaksi immutable + saldo dalam satu transaksi DB, `idempotencyKey` mencegah penggandaan.
- Backstop database: CHECK `quantity_on_hand >= 0`, `quantity_reserved >= 0`,
  `quantity_reserved <= quantity_on_hand`, quantity transaksi > 0.
- Tes integrasi kunci: *"request berulang dengan idempotency key tidak menggandakan stok"*,
  *"transfer atomik dua sisi; sisi gudang asal divalidasi"*, *"issue tidak boleh mengambil stok
  yang sedang direservasi"*, *"menerima sebagian → stok naik & status PARTIALLY_RECEIVED"*.
- Nilai persediaan mengikuti weighted-average di `inventory_costs`; hook penerimaan, pemakaian,
  dan barang jadi memperbarui nilai dalam transaksi yang sama.

## 4. Penerimaan, produksi, QC, pengiriman, payroll, dan akuntansi memakai validasi server

- Semua route handler: `auth → Zod → service → respons`; pesan validasi Bahasa Indonesia.
- Uji negatif API (`security.spec.ts`): kuantitas negatif/nol/pecahan dan item kosong → `422`,
  melebihi sisa pesanan → `409`, posting ganda → `409`, item bukan milik dokumen → `400`.
- Service menolak over-receipt/over-issue/over-shipment, payroll ganda, pembayaran melebihi
  sisa tagihan, jurnal tidak seimbang, dan posting pada periode tertutup — bukan hanya di UI.

## 5. RBAC diterapkan pada semua operasi terlindungi

- Audit otorisasi penuh: **86 route API** dan **55 halaman** — semua memakai
  `requireApiPermission()` / `requirePagePermission()`; hanya `/dashboard` dan `/akses-ditolak`
  yang bebas izin (tetap butuh sesi). Rincian: `docs/security-review.md` §2.
- E2E `roles.spec.ts`: login 8 role quick login, verifikasi menu sidebar, halaman yang diizinkan,
  dan pengalihan `/akses-ditolak`.
- E2E `finance.spec.ts`: 3 role back-office — HR tidak dapat membuka akuntansi, Finance tidak
  dapat membuka pengguna, dan halaman payroll/akuntansi dapat dibuka role yang berwenang.
- E2E `security.spec.ts`: lintas role → `403` (guard dievaluasi sebelum validasi body).

## 6. Dashboard menggunakan data aktual database

- `src/modules/dashboard/service.ts` menghitung KPI/menu langsung dari tabel (SO aktif, SPK
  berjalan, low stock, output per periode) via Drizzle — bukan data statis.
- Di produksi `/dashboard` 200 dan menampilkan pesanan lintas status dari seed
  (Draf, Dalam Produksi, Terikirim Sebagian, Siap Kirim).

## 7. Audit log merekam tindakan penting

- Setiap mutasi multi-tabel memanggil `recordAudit(tx, ...)` dalam transaksi yang sama
  (buyer, SO, PO, penerimaan, transfer, penyesuaian, SPK, output, QC, lot FG, alokasi,
  pengiriman, pengguna, absensi/cuti, payroll, jurnal, pembayaran, tutup buku).
- Seed menghasilkan audit trail lengkap; halaman `/settings/audit` (read-only, khusus ADMIN)
  + `GET /api/v1/audit-logs`; tidak ada operasi ubah/hapus.

## 8. Unit, integration, dan E2E tests untuk alur kritis lulus

| Lapis | Jumlah | Perintah |
|---|---|---|
| Unit | **125** ✓ | `pnpm test:unit` |
| Integration | **70** ✓ | `pnpm test:integration` |
| E2E (build produksi) | **47** ✓ | `pnpm build && pnpm test:e2e` |

E2E mencakup: 8 role quick login (login/menu/penolakan), 3 role back-office, buyer, SO
(buat → konfirmasi → batal), purchasing (PO → pesan → terima → posting), produksi
(SPK → output → pemakaian → QC), order-to-shipment + laporan CSV, manajemen pengguna,
audit log, Asisten AI (kirim pertanyaan, konteks halaman, validasi API), dan 10 skenario
uji negatif keamanan API.

Integration mencakup payroll (absensi + cuti → payroll → approve → pay → laporan) dan
akuntansi (COA, jurnal draf/posting, jurnal pembalik, neraca saldo, laba rugi, neraca,
arus kas, tutup buku).

## 9. Database migrations dapat dijalankan dari awal

- `pnpm db:reset` menghapus schema `public` **dan** `drizzle` (jejak migrasi), menjalankan
  `drizzle-kit migrate` dari nol, lalu `seed` — terverifikasi pada 24 Oktober 2026.
- Migrasi `0006_organic_serpent_society.sql` mencakup seluruh tabel HRIS/payroll/akuntansi.
- `scripts/backfill-accounting.ts` tersedia untuk database produksi yang sudah berisi data
  operasional sebelum modul akuntansi ditambahkan; backfill idempotent dan sudah dijalankan
  pada database lokal.

## 10. Seed data menghasilkan skenario demo yang realistis

- Master data lengkap (buyer, produk+varian/BOM, material + stok minimum, 2 gudang + lokasi,
  supplier, satuan, organisasi/lini), **6 sales order lintas status**, 5 PO, 3 SPK,
  6 inspeksi QC, lot & saldo barang jadi, 2 surat jalan POSTED, audit trail.
- **HRIS/payroll:** 25 absensi bulan berjalan, 1 cuti tidak dibayar disetujui, data gaji/
  BPJS/pajak/bank, 1 payroll bulan sebelumnya **PAID** + slip + jurnal.
- **Akuntansi:** COA + mapping, 12 jurnal, 2 faktur penjualan, 3 tagihan pembelian,
  3 pembayaran kas/bank, periode fiskal.
- Skenario presentasi 10 menit + per role: [`docs/demo.md`](./demo.md).

## 11. Deployment dapat diakses sesuai batas layanan yang dipilih

- URL publik: **https://garment-erp-olive.vercel.app** (Vercel Hobby, region `sin1`) +
  Neon Postgres free tier (Singapore). Smoke test pasca-deploy v1.1 mencakup login,
  halaman HR/payroll/akuntansi, jurnal, laporan keuangan, API tanpa sesi, dan header keamanan.
- Backfill produksi dijalankan sekali setelah migrasi `0006` sebelum mengaktifkan modul
  akuntansi untuk data lama.

## 12. README menjelaskan setup, akun demo, arsitektur, dan batasan proyek

- [`README.md`](../README.md): demo + screenshot, status F1–F7, stack, setup lokal,
  11 akun demo (8 quick login + 3 back-office), alur bisnis, skrip, testing, deployment
  Neon/Vercel, batasan paket gratis, struktur folder, konvensi, dokumen, ringkasan Inggris.
- Dokumen pendukung: [`docs/api.md`](./api.md), [`docs/demo.md`](./demo.md),
  [`docs/security-review.md`](./security-review.md), [`docs/backlog.md`](./backlog.md).

---

## Kesimpulan

Seluruh 12 butir acceptance criteria **terpenuhi** dan dapat direproduksi dengan perintah di
bagian atas dokumen ini. Proyek dinyatakan final (tag `v1.1`): ERP operasional + HRIS,
payroll, akuntansi, dan laporan keuangan.
