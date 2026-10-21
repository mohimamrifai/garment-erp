# Verifikasi Acceptance Criteria — PRD §12

Tanggal verifikasi: 19 Oktober 2026 · Versi: **v1.0** · Lingkungan: lokal (build produksi
`next start`) + deployment demo Vercel/Neon.

Cara menjalankan ulang seluruh bukti:

```bash
pnpm verify        # typegen + lint + typecheck + unit + integration
pnpm build
pnpm test:e2e      # Playwright terhadap build produksi
```

Hasil terakhir: **109 unit ✓ · 64 integration ✓ · 41 E2E ✓** (lihat §8).

---

## 1. Semua modul P0 tersedia dan berfungsi

| Kode | Modul | Implementasi | Bukti |
|---|---|---|---|
| M01 | Authentication & RBAC | Better Auth + `roles`/`user_roles` + matriks izin terketik | `roles.spec.ts` (8 role), `security.spec.ts` (401/403), `docs/security-review.md` |
| M02 | Dashboard | `src/modules/dashboard` (KPI periode 7/30/90 hari, grafik output) | `/dashboard` 200 di produksi; screenshot `docs/screenshots/02-dashboard.png` |
| M03 | Master Data | Buyer, supplier, produk+varian, material, BOM berversi, gudang+lokasi, satuan, organisasi | Halaman `/buyers`, `/master/*`; `buyer.spec.ts`; 41 halaman ter-guard |
| M04 | Sales Order | Draf → konfirmasi → pemenuhan; penomoran `SO-YYYYMM-####` | `sales-order.spec.ts`; detail pemenuhan & alokasi |
| M05 | Purchasing | PO (draf → dipesan → diterima sebagian/lengkap) + penerimaan material | `purchasing.spec.ts`; integrasi siklus PO |
| M06 | Inventory | Inventory engine (transaksi immutable + idempotensi), saldo, transfer, penyesuaian | `inventory.test.ts` (10 tes); CHECK constraint DB |
| M07 | Production Management | SPK 4 tahap, output per tahap, pemakaian material, material planning | `production.spec.ts`; integrasi output & pemakaian |
| M08 | Quality Control | Inspeksi per tahap, cacat, rework ber-`parent_inspection_id` | `production.spec.ts`; integrasi lot FG dari QC packing |
| M09 | Finished Goods & Shipment | Lot FG, alokasi/reservasi, surat jalan draf → posting | `shipping.spec.ts` (order-to-shipment penuh) |
| M10 | Reporting | 7 laporan + ekspor CSV (RFC 4180 + BOM), scoping role | E2E unduh CSV; verifikasi produksi `text/csv` 530 byte |
| M11 | Audit Log | `recordAudit(tx, ...)` di setiap mutasi + halaman read-only `/settings/audit` | 42 catatan pada seed produksi; `users.spec.ts` audit test |

## 2. Alur order-to-shipment berhasil diuji dari awal sampai akhir

- E2E `tests/e2e/shipping.spec.ts` › *"order-to-shipment: QC akhir, alokasi, surat jalan, dan
  laporan"* — dari QC packing PASS → lot barang jadi → alokasi → surat jalan → posting →
  verifikasi stok & 7 laporan + CSV.
- Dilengkapi `purchasing.spec.ts` (PO → pesan → terima → posting stok) dan `production.spec.ts`
  (SPK → output tahap → pemakaian material → QC).
- Produksi: `SO-202610-0003` berstatus **Terikirim Sebagian** dengan `SJ-202610-0002` POSTED;
  `SO-202610-0005` **Selesai** dengan `SJ-202610-0001` POSTED.

## 3. Data stok konsisten dengan transaksi mutasi

- Satu-satunya jalur perubahan saldo: **inventory engine** (`src/modules/inventory/engine.ts`) —
  transaksi immutable + saldo dalam satu transaksi DB, `idempotencyKey` mencegah penggandaan.
- Backstop database: CHECK `quantity_on_hand >= 0`, `quantity_reserved >= 0`,
  `quantity_reserved <= quantity_on_hand`, quantity transaksi > 0.
- Tes integrasi kunci: *"request berulang dengan idempotency key tidak menggandakan stok"*,
  *"transfer atomik dua sisi; sisi gudang asal divalidasi"*, *"issue tidak boleh mengambil stok
  yang sedang direservasi"*, *"menerima sebagian → stok naik & status PARTIALLY_RECEIVED"*.
- Verifikasi produksi: lot hoodie **on hand 4, dialokasikan 3, tersedia 1** — konsisten dengan
  15 unit hasil QC − 3 unit terkirim penuh − 8 unit parsial.

## 4. Penerimaan, produksi, QC, dan pengiriman menggunakan validasi server

- Semua route handler: `auth → Zod → service → respons`; pesan validasi Bahasa Indonesia.
- Uji negatif API (`security.spec.ts`): kuantitas negatif/nol/pecahan dan item kosong → `422`,
  melebihi sisa pesanan → `409`, posting ganda → `409`, item bukan milik dokumen → `400`.
- Service menolak over-receipt/over-issue/over-shipment (uji integrasi), bukan hanya di UI.

## 5. RBAC diterapkan pada semua operasi terlindungi

- Audit otorisasi penuh: **67 route API** dan **41 halaman** — semua memakai
  `requireApiPermission()` / `requirePagePermission()`; hanya `/dashboard` dan `/akses-ditolak`
  yang bebas izin (tetap butuh sesi). Rincian: `docs/security-review.md` §2.
- E2E `roles.spec.ts`: login 8 role, verifikasi menu sidebar, halaman yang diizinkan, dan
  pengalihan `/akses-ditolak` untuk halaman terlarang.
- E2E `security.spec.ts`: lintas role → `403` (guard dievaluasi sebelum validasi body).

## 6. Dashboard menggunakan data aktual database

- `src/modules/dashboard/service.ts` menghitung KPI/menu langsung dari tabel (SO aktif, SPK
  berjalan, low stock, output per periode) via Drizzle — bukan data statis.
- Di produksi `/dashboard` 200 dan menampilkan pesanan lintas status dari seed
  (Draf, Dalam Produksi, Terikirim Sebagian, Siap Kirim).

## 7. Audit log merekam tindakan penting

- Setiap mutasi multi-tabel memanggil `recordAudit(tx, ...)` dalam transaksi yang sama
  (buyer, SO, PO, penerimaan, transfer, penyesuaian, SPK, output, QC, lot FG, alokasi,
  pengiriman, pengguna).
- Seed produksi segar menghasilkan **42 catatan** (contoh: `sales-order.allocate`,
  `shipment.post`, `production.record-output`, `qc.inspect`, `user.create`).
- Halaman `/settings/audit` (read-only, khusus ADMIN) + `GET /api/v1/audit-logs`; tidak ada
  operasi ubah/hapus. Tes: `users.spec.ts` › *"admin melihat audit log dan memfilternya per aksi"*.

## 8. Unit, integration, dan E2E tests untuk alur kritis lulus

| Lapis | Jumlah | Perintah |
|---|---|---|
| Unit | **109** ✓ | `pnpm test:unit` |
| Integration | **64** ✓ | `pnpm test:integration` |
| E2E (build produksi) | **41** ✓ | `pnpm build && pnpm test:e2e` |

E2E mencakup: 8 role (login/menu/penolakan), buyer, SO (buat → konfirmasi → batal),
purchasing (PO → pesan → terima → posting), produksi (SPK → output → pemakaian → QC),
order-to-shipment + 7 laporan CSV, manajemen pengguna (buat → nonaktif → aktif),
larangan nonaktifkan akun sendiri, audit log, Asisten AI (kirim pertanyaan + validasi API),
dan 10 skenario uji negatif keamanan API.

## 9. Database migrations dapat dijalankan dari awal

- `pnpm db:reset` menghapus schema `public` **dan** `drizzle` (jejak migrasi), menjalankan
  `drizzle-kit migrate` dari nol, lalu `seed` — terverifikasi berhasil pada 19 Oktober 2026.
- Deployment produksi juga dijalankan dengan reset + migrasi + seed penuh (bukan tambal data),
  membuktikan migrasi bekerja pada database Neon yang kosong.

## 10. Seed data menghasilkan skenario demo yang realistis

- Master data lengkap (buyer, produk+varian/BOM, material + stok minimum, 2 gudang + lokasi,
  supplier, satuan, organisasi/lini), **6 sales order lintas status** (Draf, Dalam Produksi,
  Siap Kirim, Terikirim Sebagian, Selesai, Dibatalkan), 5 PO (draf → diterima penuh),
  3 SPK (selesai dengan riwayat rework, berjalan, terbuka dengan kekurangan material tercatat),
  6 inspeksi QC, lot & saldo barang jadi, 2 surat jalan POSTED, audit trail.
- Skenario presentasi 10 menit + per role: [`docs/demo.md`](./demo.md).

## 11. Deployment dapat diakses sesuai batas layanan yang dipilih

- URL publik: **https://garment-erp-olive.vercel.app** (Vercel Hobby, region `sin1`) +
  Neon Postgres free tier (Singapore). Smoke test pasca-deploy (19 Oktober 2026):

| Pemeriksaan | Hasil |
|---|---|
| `GET /login` + header keamanan (`X-Frame-Options`, `nosniff`, HSTS, dll.) | 200, header lengkap, tanpa `X-Powered-By` |
| Login `admin@garment.local` | 200 + cookie `HttpOnly` |
| `GET /api/v1/sales-orders` | 6 pesanan: DRAFT, IN_PRODUCTION, READY_TO_SHIP, PARTIALLY_SHIPPED, COMPLETED, CANCELLED |
| `GET /api/v1/shipments` | 2 surat jalan POSTED |
| `GET /api/v1/finished-goods` | on hand 4 · dialokasikan 3 · tersedia 1 |
| `GET /api/v1/audit-logs` | 42 catatan |
| Ekspor CSV `sales-fulfillment` | 200 `text/csv` (BOM + header Indonesia) |
| API tanpa sesi | 401 |
| ID non-UUID | 404 (bukan 500) |
| 10 halaman utama (dashboard → audit) | semua 200 |
| Batasan free tier (cold start, timeout, bandwidth) | didokumentasikan di README §Batasan |

## 12. README menjelaskan setup, akun demo, arsitektur, dan batasan proyek

- [`README.md`](../README.md): demo + screenshot, status F1–F6, stack, setup lokal,
  8 akun demo, alur bisnis, skrip, testing, deployment Neon/Vercel (pooled vs direct),
  batasan paket gratis, struktur folder, konvensi, dokumen, dan ringkasan Inggris.
- Dokumen pendukung: [`docs/api.md`](./api.md), [`docs/demo.md`](./demo.md),
  [`docs/security-review.md`](./security-review.md), [`docs/backlog.md`](./backlog.md).

---

## Kesimpulan

Seluruh 12 butir acceptance criteria **terpenuhi** dan dapat direproduksi dengan perintah di
bagian atas dokumen ini. MVP dinyatakan siap dipresentasikan (tag `v1.0`).
