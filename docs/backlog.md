# Backlog Pasca-v1.1

Kandidat pengembangan setelah tag **v1.1** (ERP operasional + HRIS/payroll/akuntansi).
Belum ada komitmen jadwal; prioritas menyesuaikan kebutuhan demo/portofolio berikutnya.

## Keamanan & Kepatuhan

- **CSP nonce-based** untuk menggantikan ketiadaan Content-Security-Policy saat ini.
- **2FA/MFA** (TOTP) + pemulihan kode; halaman keamanan akun (ubah password mandiri).
- **Manajemen sesi** di UI admin: daftar sesi aktif per pengguna + revoke paksa.
- **Audit login** (berhasil/gagal, IP, user agent) dan alert percobaan brute force.
- **Rotasi rahasia** terdokumentasi + secret scanning di CI (gitleaks).
- **Uji penetrasi** / security review pihak ketiga; aksesibilitas WCAG AA audit.

## Fungsional Bisnis

- **Notifikasi**: in-app + email untuk low stock, tenggat SO mendekat, PO terlambat,
  kegagalan QC berulang.
- **Approval workflow**: persetujuan PO di atas nilai tertentu, diskon SO, koreksi stok.
- **Perencanaan kapasitas produksi**: kalender lini, beban per line, penjadwalan visual (Gantt).
- **Lot/batch & kedaluwarsa material**, multi-lot picking, kontrol FIFO/FEFO.
- **Barcode/QR**: scan material, output tahap, dan surat jalan dari perangkat gudang.
- **Produk jadi multi-level BOM** (sub-assembly) dan alternatif material pada BOM.
- **Penjadwalan laporan**: ekspor terjadwal + template PDF/Excel resmi perusahaan.
- **Multi-currency** untuk buyer/supplier ekspor; kurs harian.
- **Aset tetap & depresiasi**, budgeting, dan pusat biaya.
- **E-filing pajak** (PPh 21/PPN) dan integrasi API bank untuk rekonsiliasi.
- **Employee self-service**: slip gaji, pengajuan cuti, dan data pribadi.
- **Rekrutmen, penilaian kinerja, dan pelatihan**.
- **Integrasi eksternal** (Accurate/Xero, API kurir/resi).
- **Portal buyer** (read-only status pesanan/pengiriman) dengan akses terbatas.

## Performa & Arsitektur

- **Cache** agregasi dashboard/laporan dengan `use cache` + invalidasi berbasis tag.
- **Keyset pagination** untuk tabel besar (stok, mutasi, audit log).
- **Read replica** Neon + pemisahan koneksi baca/tulis.
- **Background jobs** untuk ekspor besar dan pengiriman email (Neon Functions/cron).
- **Audit/observability**: Sentry, log terstruktur, metrik kustom (durasi aksi kritis).
- **E2E di CI** dengan Neon branch per PR (preview deploy terisolasi).

## UX & Internationalization

- **i18n** Indonesia/Inggris (UI saat ini Bahasa Indonesia).
- **PWA/mobile-first** untuk operator lantai produksi (input tahap cepat).
- **Command palette** (Ctrl+K) dan bulk actions pada tabel.
- **Onboarding interaktif** + tooltip rumus material planning.

## Kualitas & Testing

- **Kontrak API teruji** untuk seluruh endpoint (menjalankan `docs/api.md` sebagai spec).
- **Visual regression** (Playwright screenshot diff) dan **a11y** (axe) di CI.
- **Load test** (k6/Artillery) untuk endpoint posting & laporan.
- **Fuzz test** payload Zod di endpoint mutasi.

## Operasional

- **Backup & PITR** Neon, runbook pemulihan bencana.
- **Custom domain** + HTTPS/HSTS penuh di produksi (bukan domain `*.vercel.app`).
- **Staging environment** permanen dengan Neon branch `staging`.
- **Rate limit per pengguna** untuk endpoint mahal (ekspor laporan).

---

Rujukan konteks: [`PRD.md`](../PRD.md) §4 (non-goals MVP), [`docs/security-review.md`](./security-review.md)
(keterbatasan), dan [`docs/plan.md`](./plan.md) §11 (risiko & mitigasi).
