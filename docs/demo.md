# Skenario Demo — Garment ERP

Dokumen ini berisi panduan demo: cara masuk, ringkasan data seed, alur demo 10 menit
end-to-end + 5 menit back-office, dan skenario per role. Cocok dipakai saat presentasi/portofolio.

## 1. Akses

- **URL demo:** https://garment-erp-olive.vercel.app (deployment demo Vercel + Neon).
- **Password semua akun demo:** `password123` (dapat diubah lewat `SEED_DEFAULT_PASSWORD`).
- Halaman login menampilkan tombol **Masuk cepat — akun demo** bila `NEXT_PUBLIC_DEMO_MODE=1`.

| Role | Email | Fokus menu |
|---|---|---|
| Administrator | `admin@garment.local` | Semua modul + Pengguna |
| Manager | `manager@garment.local` | Semua modul kecuali Pengguna |
| Sales | `sales@garment.local` | Buyer, Sales Order, Barang Jadi, Pengiriman |
| Purchasing | `purchasing@garment.local` | Pembelian, Penerimaan, Material/Supplier |
| Gudang | `warehouse@garment.local` | Inventori, Mutasi, penerimaan, pengiriman |
| Supervisor Produksi | `produksi@garment.local` | SPK, tahapan, BOM, organisasi |
| Staff QC | `qc@garment.local` | Produksi (lihat), Quality Control |
| Staff Pengiriman | `shipping@garment.local` | Barang Jadi, Pengiriman |
| Staff HR | `hr@garment.local` | Karyawan, Absensi, Cuti |
| Admin Payroll | `payroll@garment.local` | Absensi, Cuti, Payroll, Kas & Bank |
| Staff Keuangan | `finance@garment.local` | Akuntansi, Bagan Akun, Jurnal, Kas & Bank, Tutup Buku, Laporan Keuangan |

> Delapan akun pertama tampil di tombol **Masuk cepat**. Tiga akun back-office terakhir
> memakai login email/password biasa dan tidak ditampilkan di tombol masuk cepat.

> Catatan free tier: Neon menskalakan ke nol saat idle. Permintaan pertama bisa
> terasa 5–10 detik; buka `/login` lebih dulu beberapa menit sebelum presentasi.

## 2. Data seed (setelah `pnpm db:seed`)

- **Master data:** 3 buyer, produk + varian (polo, kemeja, hoodie), BOM ber-versi,
  material dengan stok minimum, 2 gudang + lokasi (A-01 kain, A-02 aksesori, B-01
  produk jadi, C-01 kemasan), supplier, satuan, departemen/karyawan/lini produksi.
- **Sales order lintas status:** `SO-…-0001` DRAFT, `0002` IN_PRODUCTION,
  `0003` PARTIALLY_SHIPPED (8 dari 30 unit terkirim), `0004` CANCELLED,
  `0005` COMPLETED (3 unit terkirim penuh), `0006` READY_TO_SHIP (1 unit dialokasikan).
- **Pembelian:** 5 PO — draf, sudah dipesan, sebagian diterima, dan diterima penuh;
  satu PO punya penerimaan draf siap diposting dari UI.
- **Produksi & QC:** `SPK-…-0001` COMPLETED (15 hoodie, termasuk satu putaran
  rework cutting), `SPK-…-0002` IN_PROGRESS (rework menunggu dikerjakan),
  `SPK-…-0003` OPEN (kemeja, material kurang dengan alasan tercatat).
- **Stok:** saldo material dengan contoh low stock, transfer & penyesuaian opname,
  serta barang jadi hoodie di B-01 (on hand 4, dialokasikan 3, tersedia 1).
- **Pengiriman:** 2 surat jalan POSTED (satu pesanan selesai penuh, satu parsial)
  + alokasi aktif pada pesanan READY_TO_SHIP.
- **HRIS:** 25 catatan absensi bulan berjalan (hadir, terlambat, tidak hadir, lembur),
  1 pengajuan cuti tidak dibayar yang sudah disetujui, dan data gaji/BPJS/pajak/bank
  pada karyawan contoh.
- **Payroll:** 1 payroll bulan sebelumnya berstatus **PAID** beserta slip gaji dan jurnalnya.
- **Akuntansi:** COA lengkap + mapping, 12 jurnal dari penjualan/pembelian/produksi/payroll,
  2 faktur penjualan, 3 tagihan pembelian, 3 pembayaran kas/bank, dan periode fiskal.
- **Audit log** merekam seluruh mutasi di atas (dibuat lewat service layer, bukan insert langsung).

## 3. Demo 10 menit (end-to-end, satu layar)

Masuk sebagai **Administrator**:

1. **Dashboard** — kartu ringkasan, daftar pesanan aktif beserta tenggat, grafik
   output produksi 30 hari, dan aksi cepat.
2. **Sales Order** — buka `SO-…-0003` (Terikirim Sebagian): lihat bagian
   *Pemenuhan & Alokasi* (dipesan 30, terkirim 8, alokasi aktif 2) dan surat jalan
   terkait. Buka *Riwayat pengiriman* untuk melihat `SJ-…-0002` berstatus Diposting.
3. **Produksi** — buka `SPK-…-0001` (Selesai): empat kartu tahap (Cutting →
   Sewing → Finishing → Packing) dengan output & hasil QC, termasuk inspeksi
   rework yang ditutup inspeksi lanjutan.
4. **Quality Control** — daftar inspeksi, filter hasil; buka satu inspeksi untuk
   melihat detail cacat dan disposisinya.
5. **Inventori** — saldo per lokasi, filter gudang, dan penanda low stock. Buka
   **Mutasi Stok** untuk jejak transfer/penyesuaian beserta dokumen referensi.
6. **Barang Jadi** — stok per varian/lokasi, jumlah dialokasikan, dan riwayat lot
   (SPK + inspeksi QC asal lot). Tunjukkan alokasi aktif untuk `SO-…-0006`.
7. **Pengiriman** — daftar surat jalan (draf/posted), buat surat jalan baru dari
   pesanan *Siap Kirim* → posting → status pesanan berubah dan stok barang jadi
   berkurang (semua lewat inventory engine).
8. **Laporan** — 7 laporan operasional siap pakai dengan rentang tanggal, ringkasan agregat,
   dan tombol **Ekspor CSV** (RFC 4180 + BOM, langsung terbuka di Excel).
9. **Pengguna** (khusus admin) — tambah pengguna, atur role, reset password,
   nonaktifkan/aktifkan kembali; buktikan akun nonaktif tidak dapat masuk.

Lanjutan back-office (5 menit):

10. **Absensi & Cuti** — buka `/hr/attendance`, filter bulan, tunjukkan lembur dan
    ketidakhadiran; buka `/hr/leave`, lihat cuti tidak dibayar yang sudah disetujui.
11. **Payroll** — buka `/payroll`, pilih payroll bulan lalu yang sudah **Dibayar**;
    tunjukkan slip gaji berisi gaji pokok, tunjangan, lembur, potongan BPJS/PPh 21,
    dan total neto. Tunjukkan tautan jurnal payroll.
12. **Akuntansi** — buka `/accounting`: kartu kas, pendapatan, laba, dan jurnal terbaru.
    Buka **Jurnal** untuk melihat jurnal otomatis + manual; buka detail untuk baris
    debit/kredit dan tautan dokumen sumber.
13. **Kas & Bank** — tunjukkan pembayaran faktur/payroll dan penerimaan pembayaran.
14. **Tutup Buku** — tunjukkan periode berjalan dan statusnya; jelaskan bahwa periode
    hanya ditutup setelah semua jurnal diposting.
15. **Laporan Keuangan** — buka `/accounting/reports`, pilih **Neraca Saldo**, **Laba Rugi**,
    **Neraca**, dan **Arus Kas**; tunjukkan angka seimbang dan ekspor CSV.

## 4. Skenario per role (demo RBAC)

| Role | Skenario singkat |
|---|---|
| **Sales** | Buat buyer baru → buat sales order (draf) → konfirmasi → lihat bagian pemenuhan; menu Pembelian/Pengguna tidak terlihat. |
| **Purchasing** | Buat PO → *Pesan* ke supplier → buat penerimaan (sebagian) → posting penerimaan → stok material bertambah; coba buka `/qc/new` → dialihkan ke *Akses ditolak*. |
| **Gudang** | Inventori → transfer antar lokasi → penyesuaian opname (semua tercatat di Mutasi Stok); posting surat jalan; coba buka `/purchasing/new` → *Akses ditolak*. |
| **Supervisor Produksi** | Buat SPK (lihat *Periksa Ketersediaan* ala material planning) → catat output per tahap → catat pemakaian material (stok berkurang lewat engine). |
| **Staff QC** | Catat output tahap → inspeksi (PASS/REWORK/REJECT beserta cacat) → untuk inspeksi packing PASS, lot barang jadi otomatis masuk gudang. |
| **Staff Pengiriman** | Barang jadi → lihat ketersediaan → buat surat jalan → posting; coba buka `/production/new` → *Akses ditolak*. |
| **Manager** | Pantau dashboard, laporan, dan seluruh dokumen tanpa akses Pengguna; dapat menyetujui payroll dan melihat akuntansi. |
| **Staff HR** | Catat absensi → ajukan cuti → setujui/tolak; coba buka `/accounting` → *Akses ditolak*. |
| **Admin Payroll** | Buat payroll periode berjalan → periksa slip → setujui → bayar; tunjukkan jurnal otomatis. |
| **Staff Keuangan** | Periksa jurnal, catat pembayaran/penerimaan, tutup periode, buka laporan keuangan; coba buka `/settings/users` → *Akses ditolak*. |

## 5. Reset ulang data demo

Lokal (database dev):

```bash
pnpm db:reset   # hapus schema, migrasi dari nol, lalu seed
```

Produksi/Vercel: jalankan seed sekali lewat `scripts/seed.ts` dengan
`DATABASE_URL` direct Neon (lihat README bagian Deployment).
