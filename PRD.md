# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# Garment ERP System

**Versi:** 1.1.0 — Final (termasuk HRIS, Payroll & Akuntansi)  
**Status:** Approved for Implementation  
**Jenis Produk:** Web-based ERP untuk industri manufaktur garmen  
**Target:** Portofolio Full-stack Web Developer  
**Metode Pengembangan:** Iteratif, dimulai dari MVP  
**Bahasa Antarmuka:** Bahasa Indonesia  
**Zona Waktu Operasional:** Asia/Jakarta  
**Model Deployment:** Layanan cloud dengan opsi paket gratis

---

## 1. Product Overview

### 1.1 Deskripsi Produk

Garment ERP System adalah aplikasi Enterprise Resource Planning berbasis web yang mengintegrasikan proses bisnis utama perusahaan garmen, mulai dari pengelolaan pesanan pelanggan, pengadaan bahan baku, pengelolaan persediaan, pelaksanaan produksi, pemeriksaan kualitas, hingga pengiriman barang jadi.

Aplikasi menyediakan satu sumber data terpusat agar setiap departemen dapat mengakses informasi sesuai perannya dan mengikuti alur kerja yang konsisten.

### 1.2 Visi Produk

Membangun simulasi ERP manufaktur garmen yang menunjukkan bagaimana teknologi web dapat membantu perusahaan mengelola operasional, menjaga integritas data, memantau produksi, dan mengambil keputusan berdasarkan data aktual.

### 1.3 Target Pengguna

- Perusahaan garmen skala kecil hingga menengah.
- Manajer dan supervisor operasional.
- Staf purchasing dan warehouse.
- Staf produksi dan quality control.
- Staf sales dan pengiriman.
- Staf HR, payroll, dan keuangan.
- Administrator sistem.

### 1.4 Tujuan Pengembangan

1. Menghasilkan aplikasi full-stack yang benar-benar berfungsi.
2. Mengintegrasikan proses bisnis antarmodul.
3. Mengimplementasikan aturan bisnis manufaktur yang realistis.
4. Menerapkan keamanan dan integritas data.
5. Menyediakan dokumentasi teknis dan demonstrasi yang layak ditampilkan dalam portofolio profesional.

---

## 2. Final MVP Scope

### 2.1 Modul yang Wajib Dibangun

| ID | Modul | Fitur utama | Prioritas |
|---|---|---|---|
| M01 | Authentication & RBAC | Login, logout, sesi, hak akses | P0 |
| M02 | Dashboard | KPI, ringkasan operasional, peringatan | P0 |
| M03 | Master Data | Buyer, supplier, produk, material, BOM, warehouse | P0 |
| M04 | Sales Order | Pesanan, variasi produk, jumlah, tenggat | P0 |
| M05 | Purchasing | Purchase order dan penerimaan material | P0 |
| M06 | Inventory | Stok, mutasi, transfer, penyesuaian | P0 |
| M07 | Production Management | SPK dan tahapan produksi | P0 |
| M08 | Quality Control | Inspeksi, cacat, rework | P0 |
| M09 | Finished Goods & Shipment | Barang jadi dan pengiriman | P0 |
| M10 | Reporting | Laporan dan ekspor CSV | P0 |
| M11 | Audit Log | Pencatatan perubahan penting | P0 |
| M12 | HRIS | Data karyawan, kontrak, absensi, cuti | P0 |
| M13 | Payroll | Gaji bulanan, BPJS, PPh 21, slip gaji | P0 |
| M14 | Accounting | COA, jurnal, AR/AP, kas/bank, laporan keuangan | P0 |

Keempat belas modul P0 wajib berfungsi sebelum proyek dinyatakan selesai.

### 2.2 Fitur yang Tidak Termasuk Scope Final

Fitur berikut tetap di luar scope agar proyek realistis untuk satu developer:

- Multi-currency dan kurs harian.
- Aset tetap, depresiasi, dan budgeting.
- Konsolidasi multi-company dan multi-factory.
- E-filing pajak dan integrasi API bank.
- Employee self-service (pengajuan cuti/gaji oleh karyawan sendiri).
- Rekrutmen, penilaian kinerja, dan pelatihan.
- Absensi biometrik/fingerprint dan integrasi mesin pabrik.
- Barcode scanner fisik dan aplikasi mobile native.
- Integrasi dengan ERP eksternal.
- Advanced MRP dan optimasi kapasitas mesin.
- AI forecasting.
- Integrasi email, WhatsApp, atau notifikasi eksternal.

Data karyawan, absensi, cuti, payroll bulanan, BPJS, PPh 21, akuntansi double-entry,
AR/AP, kas/bank, tutup buku, dan laporan keuangan **termasuk** dalam scope final.

### 2.3 Definisi Proyek Selesai

Proyek dianggap selesai jika pengguna dapat menyelesaikan alur berikut tanpa manipulasi database manual:

**Sales Order → Material Planning → Purchasing → Material Receipt → Production → QC → Finished Goods → Shipment → Reporting**

serta alur pendukung keuangan:

**Karyawan & Kontrak → Absensi/Cuti → Payroll → Persetujuan & Pembayaran → Jurnal → Laporan Keuangan**

Setiap perubahan harus tersimpan secara konsisten dan dapat ditelusuri.

---

## 3. User Roles & Permissions

### 3.1 Role

| Role | Tanggung jawab |
|---|---|
| Admin | Pengguna, role, konfigurasi, master data |
| Manager | Dashboard dan laporan lintas departemen |
| Sales | Buyer dan sales order |
| Purchasing | Supplier dan purchase order |
| Warehouse | Penerimaan, pengeluaran, transfer, stok |
| Production Supervisor | SPK dan progres produksi |
| QC Staff | Inspeksi dan hasil QC |
| Shipping Staff | Barang jadi dan pengiriman |
| HR Staff | Data karyawan, kontrak, absensi, cuti |
| Payroll Admin | Perhitungan, persetujuan, dan pembayaran payroll |
| Finance Staff | Akuntansi, kas/bank, jurnal, laporan keuangan |

Satu pengguna dapat memperoleh lebih dari satu role jika diizinkan administrator.

### 3.2 Aturan Authorization

- Akses diperiksa pada server untuk setiap operasi yang dilindungi.
- Pengguna hanya dapat menjalankan tindakan yang diberikan kepada role-nya.
- Data sensitif tidak boleh diakses hanya dengan mengubah ID pada URL atau request.
- Tindakan kritis harus dicatat di audit log.
- Pembuatan akun dan pemberian role tidak tersedia untuk pengguna publik.
- Pengguna nonaktif tidak dapat memulai sesi baru.

---

## 4. Functional Requirements

### FR-01 — Authentication

Sistem menyediakan autentikasi, sesi yang aman, logout, serta pembatasan akses.

**Acceptance criteria:**
- Pengguna yang belum login tidak dapat mengakses halaman privat.
- Login gagal memberikan pesan yang sesuai tanpa membocorkan informasi sensitif.
- Endpoint terlindungi memeriksa sesi dan izin.
- Password tidak pernah disimpan dalam bentuk plaintext.

### FR-02 — Dashboard

Dashboard menampilkan:

- Sales order aktif.
- Production order berjalan.
- Pesanan mendekati tenggat.
- Material di bawah stok minimum.
- Output produksi per periode.
- Tingkat cacat produk.
- Barang jadi dan pengiriman.

Semua angka berasal dari database dan dapat difilter berdasarkan periode yang relevan.

### FR-03 — Master Data

Pengguna berwenang dapat mengelola:

- Buyer dan supplier.
- Produk dan model pakaian.
- Variasi ukuran dan warna.
- Material dan satuan pengukuran.
- Bill of Materials (BOM).
- Warehouse dan lokasi penyimpanan.
- Departemen, lini produksi, dan karyawan dasar.

Record yang sudah digunakan oleh transaksi tidak boleh dihapus secara sembarangan. Gunakan status aktif/nonaktif jika diperlukan.

### FR-04 — Sales Order

Setiap sales order memiliki nomor unik, buyer, item pesanan, variasi produk, kuantitas, harga jika digunakan, tanggal pesanan, dan tenggat pengiriman.

Status:

`DRAFT → CONFIRMED → IN_PRODUCTION → READY_TO_SHIP → PARTIALLY_SHIPPED → COMPLETED`

`CANCELLED` hanya diperbolehkan jika aturan pembatalan terpenuhi.

Aturan:
- Sales order berstatus Draft dapat diedit.
- Sales order harus dikonfirmasi sebelum digunakan untuk produksi.
- Perubahan pesanan yang sudah dikonfirmasi harus mengikuti aturan perubahan yang tercatat.
- Status tidak boleh berubah secara sembarang atau melompati prasyarat bisnis.

### FR-05 — Purchasing

Purchasing dapat membuat purchase order berdasarkan kebutuhan material.

Data meliputi supplier, item material, jumlah, harga beli, tanggal pemesanan, dan estimasi penerimaan.

Status:

`DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED`

`CANCELLED` diperbolehkan sesuai aturan pembatalan.

Stok tidak bertambah saat purchase order dibuat. Stok bertambah setelah penerimaan material dikonfirmasi.

### FR-06 — Inventory Management

Fitur:
- Penerimaan material.
- Pengeluaran material.
- Transfer antar lokasi.
- Penyesuaian stok dengan alasan.
- Riwayat mutasi.
- Peringatan stok minimum.
- Stok bahan baku dan barang jadi.

Aturan:
- Semua perubahan stok harus berasal dari transaksi yang sah.
- Saldo stok tidak boleh negatif pada transaksi normal.
- Transaksi yang gagal tidak boleh meninggalkan perubahan parsial.
- Perubahan bersamaan harus dilindungi dari race condition.
- Mutasi yang telah diposting tidak dihapus; koreksi menggunakan transaksi yang tercatat.
- Saldo stok harus dapat direkonsiliasi dengan transaksi mutasi.

### FR-07 — Material Planning & BOM

BOM mendefinisikan kebutuhan material untuk setiap produk atau variasi produk.

Rumus:

`Kebutuhan bruto = Kuantitas produksi × Konsumsi material per unit`

`Kebutuhan bersih = Maksimum(0, Kebutuhan bruto + Cadangan − Stok tersedia − Penerimaan terjadwal yang dapat diperhitungkan)`

Cadangan material bersifat opsional dan dikonfigurasi sesuai kebutuhan.

Sistem menampilkan:
- Kebutuhan material.
- Stok yang dapat digunakan.
- Material yang dialokasikan untuk pekerjaan lain.
- Penerimaan yang dijadwalkan.
- Kekurangan material.
- Saran kuantitas pembelian.

Material planning pada MVP merupakan perhitungan kebutuhan dasar, bukan optimasi jadwal atau kapasitas pabrik.

### FR-08 — Production Management

Production order atau SPK dapat dibuat dari sales order yang dikonfirmasi.

Informasi:
- Nomor SPK.
- Referensi sales order dan item terkait.
- Produk dan variasi.
- Target kuantitas.
- Tanggal mulai dan selesai.
- Lini produksi.
- Status produksi.
- Kebutuhan material.
- Catatan hasil tiap tahap.

Tahapan produksi standar:

1. Cutting.
2. Sewing.
3. Finishing.
4. Packing.

Setiap tahap mencatat target, kuantitas yang diproses, kuantitas lolos, kuantitas cacat, waktu, dan petugas.

Aturan:
- Tahap berikutnya tidak dapat memproses kuantitas melebihi output tersedia dari tahap sebelumnya.
- Hasil aktual tidak boleh negatif.
- Output tidak boleh melampaui kuantitas yang sah untuk diproses.
- Status selesai hanya diberikan setelah prasyarat tahap terpenuhi.
- Produksi harus dapat ditelusuri kembali ke SPK dan sales order terkait.

### FR-09 — Quality Control

QC mencatat kuantitas diperiksa, kuantitas lolos, kuantitas cacat, kategori cacat, hasil inspeksi, dan petugas.

Status hasil inspeksi:

`PENDING`, `PASS`, `FAIL`, `REWORK`

Aturan:
- Kuantitas lolos dan cacat tidak boleh melebihi kuantitas diperiksa.
- Hasil QC harus merujuk pada tahap atau lot produksi yang jelas.
- Barang yang belum lolos QC akhir tidak boleh dialokasikan untuk pengiriman.
- Rework harus tercatat sebagai proses lanjutan, bukan produksi baru yang menggandakan kuantitas.
- Pemeriksaan ulang dicatat sebagai inspeksi baru yang terkait dengan inspeksi sebelumnya.

### FR-10 — Finished Goods & Shipment

Sistem mencatat barang jadi yang lolos QC akhir.

Fitur:
- Stok barang jadi.
- Alokasi untuk sales order.
- Dokumen pengiriman.
- Kuantitas pengiriman.
- Tanggal pengiriman.
- Pengiriman parsial.
- Riwayat pemenuhan pesanan.

Aturan:
- Kuantitas yang dikirim tidak boleh melebihi saldo pesanan atau stok barang jadi yang dapat dialokasikan.
- Pengiriman hanya dapat diposting jika validasi berhasil.
- Saldo pesanan diperbarui secara konsisten.
- Pesanan menjadi Completed setelah kuantitas yang wajib dipenuhi selesai dikirim atau diselesaikan melalui prosedur bisnis yang sah.

### FR-11 — Reporting & Audit

Laporan operasional:
- Sales order dan pemenuhan pesanan.
- Purchase order dan penerimaan.
- Stok dan mutasi material.
- Output produksi per tahap.
- Target versus aktual.
- Hasil QC dan defect rate.
- Stok barang jadi dan pengiriman.

Laporan keuangan:
- Neraca saldo, laba rugi, neraca, dan buku besar.
- Arus kas, umur piutang, umur utang, dan rekap payroll.

Ekspor mendukung CSV dengan filter periode dan scoping role.

Audit log mencatat aktor, tindakan, entitas, waktu, dan ringkasan perubahan penting. Log tidak boleh menyimpan password, token, atau rahasia aplikasi.

---


### FR-12 — HRIS

Fitur:
- Data karyawan: departemen, jabatan, tipe kerja, tanggal masuk/keluar, kontrak.
- Data payroll karyawan: gaji pokok, tunjangan tetap, status PTKP, data bank, NPWP.
- Absensi bulanan: hadir, terlambat, tidak hadir, cuti, sakit, libur, dan jam lembur.
- Pengajuan cuti, persetujuan/penolakan, dan pembatalan.
- Jenis cuti dengan kuota tahunan dan penanda dibayar/tidak dibayar.

Aturan:
- Absensi unik per karyawan per tanggal.
- Cuti tidak dibayar mengurangi gaji pada payroll.
- Cuti yang disetujui tidak boleh tumpang tindih untuk karyawan yang sama.
- Perubahan data kepegawaian dicatat di audit log.
- Tidak ada self-service karyawan; pengelolaan oleh HR Staff/Admin.

### FR-13 — Payroll

Fitur:
- Payroll bulanan per periode `YYYY-MM` dengan status `DRAFT → APPROVED → PAID` atau `CANCELLED`.
- Perhitungan gaji pokok, tunjangan, lembur, potongan ketidakhadiran/cuti tidak dibayar.
- BPJS Kesehatan, JHT, JP, JKK, JKM dengan tarif yang dapat dikonfigurasi.
- PPh 21 progresif berdasarkan PTKP dan status pajak karyawan.
- Slip gaji per karyawan dengan rincian komponen.
- Posting jurnal payroll otomatis saat persetujuan; pembayaran lewat kas/bank.

Aturan:
- Satu payroll per periode (tidak boleh ganda).
- Payroll hanya dapat diubah/dibatalkan saat `DRAFT`.
- Persetujuan memposting jurnal beban gaji, utang pajak/BPJS, dan utang gaji.
- Pembayaran payroll harus sama dengan total gaji bersih dan memposting jurnal kas/bank.
- Perhitungan menggunakan pembulatan uang dua desimal dan tarif default yang terdokumentasi.

### FR-14 — Accounting & Financial Reports

Fitur:
- Bagan akun (COA) dengan tipe, saldo normal, akun induk, dan penanda kas/bank.
- Pemetaan akun otomatis untuk penjualan, pembelian, persediaan, HPP, payroll, dan pajak.
- Jurnal umum manual (draf → posting) dan jurnal otomatis dari transaksi operasional.
- Buku besar, neraca saldo, laba rugi, neraca, arus kas, umur piutang, umur utang.
- Faktur penjualan otomatis dari pengiriman; tagihan pembelian otomatis dari penerimaan material.
- Pembayaran/penerimaan kas/bank yang merujuk tepat satu dokumen (faktur, tagihan, atau payroll).
- Periode fiskal dan tutup buku bulanan.

Aturan:
- Double-entry: total debit = total kredit untuk setiap jurnal.
- Jurnal yang sudah diposting tidak dapat diubah atau dihapus; koreksi memakai jurnal pembalik.
- Idempotensi jurnal otomatis berdasarkan `source_type + source_id + source_event`.
- Jurnal `POSTED` dan `REVERSED` tetap masuk laporan agar pembalik saling meniadakan.
- Tidak boleh membuat/memposting jurnal pada periode yang sudah ditutup.
- PPN default 11% dan dapat diubah di pengaturan akuntansi.
- Persediaan memakai weighted-average; nilai persediaan tercermin di `inventory_costs`.
- Laporan keuangan mengikuti SAK EMKM sederhana dan hanya dalam IDR.

---

## 5. Final Business Workflow

### Workflow A — Order to Shipment

1. Sales membuat sales order.
2. Sales order dikonfirmasi.
3. Supervisor membuat SPK.
4. Sistem menghitung kebutuhan material berdasarkan BOM.
5. Warehouse dan purchasing memeriksa ketersediaan material.
6. Purchasing memesan material yang kurang.
7. Warehouse mengonfirmasi penerimaan.
8. Sistem mencatat pemakaian material dan alokasi untuk produksi.
9. Produksi menjalankan cutting, sewing, finishing, dan packing.
10. QC melakukan inspeksi.
11. Barang yang lolos QC akhir masuk ke persediaan barang jadi.
12. Shipping membuat dan memposting pengiriman.
13. Sistem memperbarui saldo pesanan dan laporan.

### Workflow B — Stock Movement

1. Pengguna memilih jenis transaksi.
2. Sistem memvalidasi lokasi, material, kuantitas, dan izin.
3. Sistem memeriksa saldo yang dapat digunakan.
4. Sistem menyimpan transaksi dan memperbarui saldo dalam satu transaksi database.
5. Sistem mencatat aktor dan waktu.
6. Sistem menyediakan riwayat mutasi untuk audit.

### Workflow C — Defect & Rework

1. QC mencatat hasil inspeksi.
2. Barang cacat dipisahkan dari barang lolos.
3. Supervisor menentukan tindakan.
4. Barang yang diizinkan untuk rework diproses melalui tahapan terkait.
5. QC melakukan pemeriksaan ulang.
6. Sistem mencatat hasil final tanpa menggandakan jumlah barang yang diproduksi.

---


### Workflow D — HRIS ke Payroll

1. HR melengkapi data karyawan, kontrak, gaji pokok, tunjangan, status pajak, dan data bank.
2. HR mencatat absensi bulanan dan memproses pengajuan cuti.
3. Payroll Admin membuat payroll periode berjalan dari karyawan aktif, absensi, dan cuti disetujui.
4. Sistem menghitung lembur, potongan, BPJS, dan PPh 21, lalu menghasilkan slip gaji.
5. Payroll Admin/Manager menyetujui payroll; jurnal beban gaji dan kewajiban diposting.
6. Finance/Payroll Admin membayar payroll melalui akun kas/bank; jurnal pembayaran diposting.

### Workflow E — Accounting & Financial Closing

1. Transaksi penjualan, penerimaan material, produksi, dan payroll memicu jurnal otomatis yang idempotent.
2. Finance memeriksa jurnal, memposting jurnal manual, dan mencatat pembayaran/penerimaan kas/bank.
3. Sistem memperbarui subledger AR/AP dan status faktur/tagihan.
4. Finance membuka laporan keuangan dan mencocokkan neraca saldo, laba rugi, neraca, serta arus kas.
5. Setelah semua jurnal periode diposting, Finance menutup periode fiskal.
6. Koreksi setelah tutup buku dilakukan lewat jurnal pembalik pada periode terbuka berikutnya.

---

## 6. ERD — Final Logical Data Model

Rancangan database berorientasi pada transaksi yang dapat ditelusuri. Tabel transaksi menyimpan riwayat operasional, sedangkan saldo persediaan digunakan sebagai proyeksi terkini yang harus konsisten dengan mutasi.

### 6.1 Authentication & Authorization

**users**
- id (UUID, PK)
- name
- email (UNIQUE)
- password_hash
- is_active
- created_at
- updated_at

**roles**
- id (UUID, PK)
- code (UNIQUE)
- name

**user_roles**
- user_id (FK → users.id)
- role_id (FK → roles.id)
- PK gabungan: user_id, role_id

Role final didefinisikan sebagai role tetap pada aplikasi. Tabel permissions terpisah dapat ditambahkan jika kebutuhan otorisasi makin kompleks.

### 6.2 Organization & Master Data

**departments**
- id (UUID, PK)
- code (UNIQUE)
- name
- is_active

**employees**
- id (UUID, PK)
- employee_code (UNIQUE)
- name
- department_id (FK → departments.id)
- job_title
- employment_status

**buyers**
- id (UUID, PK)
- code (UNIQUE)
- name
- contact_information
- is_active

**suppliers**
- id (UUID, PK)
- code (UNIQUE)
- name
- contact_information
- is_active

**products**
- id (UUID, PK)
- sku (UNIQUE)
- name
- description
- is_active

**product_variants**
- id (UUID, PK)
- product_id (FK → products.id)
- size
- color
- sku (UNIQUE)
- is_active

**units_of_measure**
- id (UUID, PK)
- code (UNIQUE)
- name

**materials**
- id (UUID, PK)
- code (UNIQUE)
- name
- unit_id (FK → units_of_measure.id)
- minimum_stock
- is_active

**warehouses**
- id (UUID, PK)
- code (UNIQUE)
- name
- is_active

**warehouse_locations**
- id (UUID, PK)
- warehouse_id (FK → warehouses.id)
- code
- name
- UNIQUE (warehouse_id, code)

**production_lines**
- id (UUID, PK)
- code (UNIQUE)
- name
- is_active

### 6.3 Bill of Materials

**bills_of_materials**
- id (UUID, PK)
- product_variant_id (FK → product_variants.id)
- version
- is_active
- effective_from
- effective_until
- UNIQUE (product_variant_id, version)

**bom_items**
- id (UUID, PK)
- bom_id (FK → bills_of_materials.id)
- material_id (FK → materials.id)
- quantity_per_unit (DECIMAL)
- scrap_allowance (DECIMAL)
- UNIQUE (bom_id, material_id)

BOM yang sudah digunakan oleh production order harus dipertahankan sebagai referensi historis. Perubahan spesifikasi dibuat sebagai versi baru.

### 6.4 Sales

**sales_orders**
- id (UUID, PK)
- order_number (UNIQUE)
- buyer_id (FK → buyers.id)
- order_date
- due_date
- status
- created_by (FK → users.id)
- created_at
- updated_at

**sales_order_items**
- id (UUID, PK)
- sales_order_id (FK → sales_orders.id)
- product_variant_id (FK → product_variants.id)
- quantity (INTEGER)
- unit_price (DECIMAL)
- due_date

Kuantitas pesanan harus positif. Harga menggunakan tipe numerik desimal.

### 6.5 Purchasing & Receiving

**purchase_orders**
- id (UUID, PK)
- po_number (UNIQUE)
- supplier_id (FK → suppliers.id)
- order_date
- expected_date
- status
- created_by (FK → users.id)
- created_at

**purchase_order_items**
- id (UUID, PK)
- purchase_order_id (FK → purchase_orders.id)
- material_id (FK → materials.id)
- ordered_quantity (DECIMAL)
- unit_price (DECIMAL)

**material_receipts**
- id (UUID, PK)
- receipt_number (UNIQUE)
- purchase_order_id (FK → purchase_orders.id)
- received_at
- received_by (FK → users.id)
- status

**material_receipt_items**
- id (UUID, PK)
- material_receipt_id (FK → material_receipts.id)
- purchase_order_item_id (FK → purchase_order_items.id)
- received_quantity (DECIMAL)
- accepted_quantity (DECIMAL)

Penerimaan parsial diperbolehkan. Total penerimaan tidak boleh melebihi kuantitas pesanan kecuali terdapat prosedur toleransi yang secara eksplisit ditetapkan.

### 6.6 Inventory

**inventory_balances**
- id (UUID, PK)
- material_id (FK → materials.id, nullable sesuai tipe item)
- product_variant_id (FK → product_variants.id, nullable sesuai tipe item)
- warehouse_location_id (FK → warehouse_locations.id)
- quantity_on_hand (DECIMAL)
- quantity_reserved (DECIMAL)
- updated_at

Constraints:
- Setiap saldo mengacu pada satu jenis item yang valid.
- Kombinasi item dan lokasi harus unik.
- `quantity_on_hand` tidak boleh negatif.
- `quantity_reserved` tidak boleh negatif atau melebihi saldo yang tersedia.

Untuk implementasi yang lebih kuat, gunakan tabel saldo material dan saldo barang jadi yang terpisah jika pemodelan satu tabel dengan dua FK opsional menambah kompleksitas.

**inventory_transactions**
- id (UUID, PK)
- transaction_number (UNIQUE)
- item_type
- material_id (FK, nullable)
- product_variant_id (FK, nullable)
- from_location_id (FK → warehouse_locations.id, nullable)
- to_location_id (FK → warehouse_locations.id, nullable)
- transaction_type
- quantity (DECIMAL)
- reference_type
- reference_id
- posted_at
- posted_by (FK → users.id)
- idempotency_key (UNIQUE bila digunakan)

Mutasi yang sudah diposting bersifat immutable. Transfer harus mengurangi stok asal dan menambah stok tujuan dalam satu transaksi database.

### 6.7 Production

**production_orders**
- id (UUID, PK)
- production_number (UNIQUE)
- sales_order_item_id (FK → sales_order_items.id)
- bom_id (FK → bills_of_materials.id)
- production_line_id (FK → production_lines.id)
- planned_quantity (INTEGER)
- planned_start_date
- planned_end_date
- status
- created_by (FK → users.id)
- created_at

**production_stages**
- id (UUID, PK)
- production_order_id (FK → production_orders.id)
- stage_code
- sequence_number
- target_quantity
- status
- UNIQUE (production_order_id, sequence_number)

**production_records**
- id (UUID, PK)
- production_stage_id (FK → production_stages.id)
- processed_quantity (INTEGER)
- passed_quantity (INTEGER)
- rejected_quantity (INTEGER)
- recorded_by (FK → users.id)
- recorded_at
- notes

Record produksi harus memvalidasi hubungan kuantitas antar-tahap. Total output tidak boleh dihitung ganda ketika data koreksi atau inspeksi ulang dibuat.

### 6.8 Quality Control

**qc_inspections**
- id (UUID, PK)
- production_stage_id (FK → production_stages.id)
- inspected_quantity (INTEGER)
- passed_quantity (INTEGER)
- rejected_quantity (INTEGER)
- result
- inspected_by (FK → users.id)
- inspected_at
- notes
- parent_inspection_id (FK → qc_inspections.id, nullable)

**qc_defects**
- id (UUID, PK)
- inspection_id (FK → qc_inspections.id)
- defect_code
- defect_name
- quantity
- disposition

Jumlah cacat pada detail inspeksi harus direkonsiliasi dengan total yang dilaporkan, atau sistem harus mendefinisikan secara jelas mana yang merupakan jumlah produk dan mana yang merupakan jumlah jenis cacat.

### 6.9 Finished Goods & Shipment

**finished_goods**
- id (UUID, PK)
- product_variant_id (FK → product_variants.id)
- warehouse_location_id (FK → warehouse_locations.id)
- production_order_id (FK → production_orders.id)
- qc_inspection_id (FK → qc_inspections.id)
- quantity
- created_at

Catatan: implementasi dapat menggunakan inventory balance dan transaksi barang jadi sebagai sumber saldo utama, dengan tabel lot atau receipt barang jadi untuk traceability. Hindari menghitung saldo dua kali dari dua sumber berbeda.

**shipments**
- id (UUID, PK)
- shipment_number (UNIQUE)
- sales_order_id (FK → sales_orders.id)
- shipped_at
- status
- shipped_by (FK → users.id)

**shipment_items**
- id (UUID, PK)
- shipment_id (FK → shipments.id)
- sales_order_item_id (FK → sales_order_items.id)
- product_variant_id (FK → product_variants.id)
- quantity

Pengiriman harus divalidasi terhadap stok barang jadi yang lolos QC dan saldo kuantitas pesanan yang belum dipenuhi.

### 6.10 Audit Log

**audit_logs**
- id (UUID, PK)
- user_id (FK → users.id, nullable untuk kejadian sistem tertentu)
- action
- entity_type
- entity_id
- old_values (JSONB, nullable)
- new_values (JSONB, nullable)
- created_at
- request_id (nullable)

Audit log tidak menyediakan operasi pengeditan atau penghapusan melalui antarmuka aplikasi normal.

### 6.11 HRIS & Payroll

**employees** (diperluas)
- basic_salary, fixed_allowance, tax_status
- bpjs_kesehatan_number, bpjs_ketenagakerjaan_number, npwp
- bank_name, bank_account_number, bank_account_name
- contract_start_date, contract_end_date, resign_date

**attendance_records**
- employee_id (FK → employees.id), attendance_date (unik per karyawan)
- status, check_in, check_out, overtime_hours, notes

**leave_types**
- code (UNIQUE), name, is_paid, max_days_per_year

**leave_requests**
- employee_id, leave_type_id, start_date, end_date, status
- reason, approved_by, approved_at, rejection_reason

**payroll_runs**
- number (UNIQUE), period (`YYYY-MM`, UNIQUE), status
- total_gross, total_deductions, total_net, total_employer_contributions
- journal_entry_id, approved_by/at, paid_at, payment_account_id

**payslips**
- payroll_run_id, employee_id, komponen gaji/lembur/potongan
- bpjs_kesehatan, bpjs_jht, bpjs_jp, bpjs_jkk, bpjs_jkm
- pph21, net, bank snapshot

### 6.12 Accounting

**accounts**
- code (UNIQUE), name, type, normal_balance, parent_id
- is_cash_bank, bank_name, account_number, is_active

**account_mappings**
- key (UNIQUE, mis. `ACCOUNTS_RECEIVABLE`), account_id

**accounting_settings**
- vat_rate, company_name, npwp, address

**fiscal_periods**
- year, month (UNIQUE bersama), start_date, end_date, status (OPEN/CLOSED)

**journal_entries**
- number (UNIQUE), journal_date, period_id, description, status
- cash_flow_category, source_type, source_id, source_event (UNIQUE bersama)
- reversal_of_id, posted_at, posted_by

**journal_lines**
- journal_entry_id, account_id, description, debit, credit

**sales_invoices / sales_invoice_items**
- number, shipment_id, buyer_id, invoice_date, due_date, total, amount_paid, status

**purchase_bills / purchase_bill_items**
- number, receipt_id, supplier_id, bill_date, due_date, total, amount_paid, status

**payments**
- number, type (RECEIPT/PAYMENT), payment_date, amount, account_id
- reference_type, reference_id, party_type, party_id, journal_entry_id

**inventory_costs**
- material_id/location_id, quantity, unit_cost, total_value (weighted-average)

### 6.13 Relasi Inti

- Buyer 1:N Sales Orders.
- Sales Order 1:N Sales Order Items.
- Sales Order Item 1:N Production Orders.
- Product Variant 1:N BOM Versions.
- BOM 1:N BOM Items.
- Material 1:N BOM Items.
- Supplier 1:N Purchase Orders.
- Purchase Order 1:N Purchase Order Items.
- Purchase Order 1:N Material Receipts.
- Material Receipt 1:N Material Receipt Items.
- Warehouse Location 1:N Inventory Balances.
- Production Order 1:N Production Stages.
- Production Stage 1:N Production Records.
- Production Stage 1:N QC Inspections.
- Sales Order 1:N Shipments.
- Shipment 1:N Shipment Items.
- User 1:N Audit Logs.
- Employee 1:N Attendance Records.
- Employee 1:N Leave Requests.
- Payroll Run 1:N Payslips.
- Journal Entry 1:N Journal Lines.
- Sales Invoice 1:N Payments (lewat referensi dokumen).
- Purchase Bill 1:N Payments (lewat referensi dokumen).

**Catatan integritas:** diagram konseptual di atas perlu diwujudkan dengan foreign keys, unique constraints, check constraints, transaksi database, dan validasi layanan. Aturan yang melibatkan banyak baris, seperti total penerimaan atau batas kuantitas pengiriman, tidak cukup hanya menggunakan validasi form.

---

## 7. Arsitektur Aplikasi

### 7.1 Keputusan Arsitektur

Gunakan **modular monolith**: satu aplikasi Next.js dengan modul bisnis yang terpisah secara logis, satu PostgreSQL database, dan satu repository.

Pendekatan ini lebih realistis daripada microservices untuk proyek portofolio yang dikerjakan seorang developer.

### 7.2 Stack Final

| Layer | Teknologi |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Forms | React Hook Form + Zod |
| Backend | Next.js Route Handlers + service layer |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Migrations | Drizzle Kit |
| Charts | Recharts |
| Authentication | Better Auth (email + password, sesi cookie, RBAC) |
| Testing | Vitest dan Playwright |
| Version control | Git dan GitHub |
| Deployment | Vercel + Neon Postgres (paket gratis) |

Pemilihan layanan eksternal harus diverifikasi terhadap kuota, masa aktif, kebutuhan kartu, dan syarat terbaru sebelum deployment.

### 7.3 Prinsip Arsitektur

1. UI tidak mengandung aturan bisnis kritis.
2. Validasi request dilakukan di server.
3. Service layer bertanggung jawab atas aturan bisnis.
4. Repository atau modul data menangani akses database.
5. Transaksi yang memengaruhi stok, penerimaan, produksi, atau pengiriman dijalankan secara atomik.
6. Semua akses data memeriksa autentikasi dan otorisasi.
7. Schema database dan migrations menjadi bagian version control.
8. Modul saling berinteraksi melalui service yang jelas, bukan saling mengimpor implementasi internal secara sembarangan.

### 7.4 Struktur Folder Final

```text
garment-erp/
├── drizzle/
│   └── migrations/
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── sales-orders/
│   │   │   ├── purchasing/
│   │   │   ├── inventory/
│   │   │   ├── production/
│   │   │   ├── quality-control/
│   │   │   ├── shipments/
│   │   │   ├── master/
│   │   │   ├── hr/
│   │   │   ├── payroll/
│   │   │   ├── accounting/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/
│   │       └── v1/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── shared/
│   ├── modules/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── master-data/
│   │   ├── sales/
│   │   ├── purchasing/
│   │   ├── inventory/
│   │   ├── production/
│   │   ├── quality-control/
│   │   ├── shipping/
│   │   ├── hr/
│   │   ├── payroll/
│   │   ├── accounting/
│   │   ├── reports/
│   │   └── audit/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   │   ├── schema/
│   │   │   ├── client.ts
│   │   │   └── relations.ts
│   │   ├── permissions/
│   │   ├── validation/
│   │   └── utils/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── drizzle.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

Setiap modul bisnis sebaiknya memiliki struktur internal yang konsisten, misalnya:

```text
modules/inventory/
├── components/
├── schemas/
├── services/
├── repositories/
├── actions/
└── types.ts
```

Folder hanya dibuat ketika memang diperlukan; jangan membuat lapisan abstraksi kosong hanya untuk memenuhi struktur.

### 7.5 Data Flow

Contoh transaksi penerimaan material:

1. Pengguna mengirim request penerimaan.
2. Server memverifikasi sesi dan role.
3. Zod memvalidasi payload.
4. Service memeriksa status purchase order dan sisa kuantitas yang boleh diterima.
5. Database transaction menyimpan receipt, receipt items, dan inventory movements.
6. Saldo stok diperbarui secara atomik.
7. Audit log dicatat.
8. Server mengembalikan hasil transaksi.

Jika satu langkah kritis gagal, transaksi bisnis harus dibatalkan secara utuh.

### 7.6 API Convention

Endpoint menggunakan prefix `/api/v1`.

Contoh:
- `GET /api/v1/sales-orders`
- `POST /api/v1/sales-orders`
- `GET /api/v1/production-orders`
- `POST /api/v1/production-orders`
- `POST /api/v1/material-receipts`
- `POST /api/v1/inventory/adjustments`
- `POST /api/v1/qc-inspections`
- `POST /api/v1/shipments`
- `POST /api/v1/hr/attendance`
- `POST /api/v1/hr/leave-requests`
- `POST /api/v1/payroll/runs`
- `POST /api/v1/payroll/runs/{id}/approve`
- `POST /api/v1/accounting/journals`
- `POST /api/v1/accounting/payments`

Operasi posting transaksi harus memiliki validasi status, otorisasi, dan proteksi terhadap pengiriman request berulang. Untuk operasi kritis, gunakan idempotency key atau mekanisme unik lain yang sesuai.

Endpoint tidak wajib dibuat terpisah untuk semua operasi jika Server Actions atau mekanisme internal Next.js sudah memenuhi kebutuhan. Pilihan implementasi harus konsisten dan terdokumentasi.

---

## 8. Non-Functional Requirements

### Security
- Password hashing menggunakan algoritma yang sesuai.
- Tidak menyimpan rahasia dalam source code.
- Authorization pada server.
- Validasi input dan perlindungan terhadap akses lintas pengguna.
- Audit log untuk transaksi kritis.
- Proteksi CSRF dan sesi sesuai mekanisme autentikasi yang dipilih.

### Performance
- Pagination pada tabel besar.
- Indeks pada foreign keys dan kolom pencarian yang relevan.
- Dashboard menggunakan query agregasi yang efisien.
- Target awal demo: mayoritas request sederhana selesai dalam sekitar dua detik pada lingkungan pengujian yang memadai.

### Data Integrity
- Foreign keys dan unique constraints.
- Check constraints untuk nilai yang dapat divalidasi di database.
- Database transaction untuk operasi multi-tabel.
- Proteksi race condition pada saldo stok dan pengiriman.
- Strategi koreksi transaksi tanpa menghapus riwayat.

### Maintainability
- TypeScript strict mode.
- Validasi terpusat.
- Migrations terkontrol.
- Unit, integration, dan end-to-end tests.
- README yang dapat diikuti developer lain.

### Usability
- Antarmuka responsif.
- Navigasi konsisten.
- Form dengan pesan validasi yang jelas.
- Filter, pencarian, pengurutan, dan pagination.
- Status dan istilah bisnis yang konsisten dalam Bahasa Indonesia.

---

## 9. Testing Strategy

### Unit Tests
- Kalkulasi kebutuhan material.
- Kalkulasi saldo pesanan.
- Defect rate dan production attainment.
- Validasi transisi status.
- Aturan role dan permission.

### Integration Tests
- Penerimaan material memperbarui stok.
- Pengeluaran material menolak kuantitas yang tidak tersedia.
- Transfer memperbarui kedua lokasi secara atomik.
- Output produksi memvalidasi kuantitas tahap sebelumnya.
- QC akhir menentukan barang yang dapat dikirim.
- Pengiriman memperbarui saldo pesanan dengan benar.
- Payroll menghitung lembur, cuti tidak dibayar, BPJS, dan PPh 21 sesuai tarif.
- Persetujuan payroll memposting jurnal yang seimbang dan idempotent.
- Jurnal pembalik meniadakan jurnal asli tanpa menghapus riwayat.
- Laporan keuangan (neraca saldo, laba rugi, neraca, arus kas) konsisten dengan jurnal.

### End-to-End Tests
- Login sebagai role berbeda.
- Membuat buyer dan sales order.
- Membuat SPK dan mencatat progres.
- Menerima material dari purchase order.
- Menyelesaikan QC dan pengiriman.
- Memastikan pengguna tanpa izin ditolak.
- Membuat payroll, menyetujui, dan membayar.
- Mencatat absensi/cuti dan melihat pengaruhnya ke payroll.
- Membuka jurnal, kas/bank, tutup buku, dan laporan keuangan.

### Security Tests
- Pengguna tanpa sesi tidak dapat mengakses endpoint privat.
- Pengguna tidak dapat mengubah data melalui manipulasi request.
- Pengguna tidak dapat mengakses data lintas role tanpa izin.
- Request berulang tidak menggandakan transaksi.
- Kuantitas negatif dan nilai tidak valid ditolak.

---

## 10. Implementation Roadmap

### Phase 1 — Foundation
- Inisialisasi Next.js dan TypeScript.
- Konfigurasi PostgreSQL dan Drizzle ORM.
- Database migrations.
- Authentication dan RBAC.
- Layout dashboard dan komponen dasar.

### Phase 2 — Master Data & Sales
- Buyer, supplier, produk, variasi, material, BOM.
- Sales order dan item pesanan.
- Validasi dan pengujian dasar.

### Phase 3 — Purchasing & Inventory
- Purchase order.
- Material receipt.
- Inventory transaction dan balance.
- Transfer dan adjustment.
- Pengujian konsistensi stok.

### Phase 4 — Production & QC
- Production order dan tahapan.
- Pencatatan output.
- Material planning.
- QC, defect, dan rework.
- Pengujian kuantitas antar-tahap.

### Phase 5 — Finished Goods & Reporting
- Pencatatan barang jadi.
- Shipment dan pemenuhan pesanan.
- Dashboard berbasis data.
- Laporan dan ekspor CSV.
- Audit log.

### Phase 6 — Release Readiness
- E2E testing.
- Security review.
- Seed data.
- Deployment.
- Dokumentasi teknis dan screenshot portofolio.

### Phase 7 — HRIS, Payroll & Accounting (penambahan final)
- Schema karyawan/payroll, absensi, cuti, dan akuntansi.
- Perhitungan BPJS/PPh 21, slip gaji, persetujuan, dan pembayaran payroll.
- COA, jurnal immutable, AR/AP, kas/bank, periode fiskal, dan tutup buku.
- Laporan keuangan dan integrasi otomatis dari penjualan, pembelian, produksi, dan payroll.
- Backfill data produksi lama + pengujian unit/integration/E2E.

Estimasi awal adalah sekitar empat hingga enam minggu dengan pengerjaan konsisten, tetapi waktu sebenarnya bergantung pada kedalaman pengujian dan kompleksitas implementasi.

---

## 11. Deployment & Cost Constraints

Persyaratan deployment:
- Tidak membutuhkan VPS berbayar.
- Memprioritaskan paket gratis.
- Tidak mewajibkan kartu pembayaran jika penyedia yang memenuhi syarat tersedia.
- Menggunakan environment variables.
- Menyediakan `.env.example` tanpa secret.
- Memiliki seed data sintetis.
- Menyediakan akun demo dengan role berbeda.

Deployment bukan alasan untuk mengorbankan keamanan. Kredensial database tidak boleh diekspos ke browser dan database tidak boleh dibuka untuk akses publik yang tidak diperlukan.

Paket gratis merupakan batasan operasional untuk demonstrasi portofolio, bukan jaminan kesiapan produksi perusahaan.

---

## 12. Acceptance Criteria Final

Proyek dapat dinyatakan siap dipresentasikan jika:

- [ ] Semua modul P0 tersedia dan berfungsi.
- [ ] Alur order-to-shipment berhasil diuji dari awal sampai akhir.
- [ ] Data stok konsisten dengan transaksi mutasi.
- [ ] Penerimaan, produksi, QC, dan pengiriman menggunakan validasi server.
- [ ] RBAC diterapkan pada semua operasi terlindungi.
- [ ] Dashboard menggunakan data aktual database.
- [ ] Audit log merekam tindakan penting.
- [ ] Unit, integration, dan E2E tests untuk alur kritis lulus.
- [ ] Database migrations dapat dijalankan dari awal.
- [ ] Seed data menghasilkan skenario demo yang realistis.
- [ ] Deployment dapat diakses sesuai batas layanan yang dipilih.
- [ ] Payroll bulanan dihitung, disetujui, dibayar, dan diposting ke akuntansi.
- [ ] Laporan keuangan (neraca saldo, laba rugi, neraca, arus kas) konsisten dan seimbang.
- [ ] Jurnal immutable, idempotent, dan koreksi memakai jurnal pembalik.
- [ ] README menjelaskan setup, akun demo, arsitektur, dan batasan proyek.

---

## 13. Final Technical Decisions

Keputusan berikut menjadi acuan implementasi:

1. **Product:** Garment ERP System.
2. **Architecture:** Modular monolith.
3. **Frontend & backend:** Next.js App Router + TypeScript.
4. **Database:** PostgreSQL.
5. **ORM:** Drizzle ORM.
6. **Validation:** Zod.
7. **UI:** Tailwind CSS + shadcn/ui.
8. **Scope:** 14 modul final yang tercantum pada dokumen.
9. **Database design:** Relational schema dengan foreign keys, constraints, dan transaksi atomik.
10. **Inventory:** Mutation ledger sebagai riwayat transaksi; saldo sebagai proyeksi yang harus direkonsiliasi.
11. **Production:** Tracking cutting, sewing, finishing, dan packing.
12. **Quality:** Inspeksi, defect, dan rework dengan kontrol kuantitas.
13. **Deployment:** Paket gratis yang memenuhi kebutuhan demonstrasi, tanpa ketergantungan pada VPS berbayar.
14. **Development order:** Foundation → Master Data & Sales → Purchasing & Inventory → Production & QC → Shipment & Reporting → HRIS/Payroll → Accounting → Release.
15. **HRIS/Payroll:** Karyawan, kontrak, absensi manual/import, cuti, payroll bulanan, BPJS, PPh 21, slip gaji; tanpa self-service.
16. **Accounting:** Double-entry, jurnal immutable, AR/AP, kas/bank, periode fiskal, tutup buku, laporan SAK EMKM; hanya IDR.
17. **Roles:** 11 role; quick login demo tetap 8 akun, sedangkan HR/Payroll/Finance memakai akun tambahan.
18. **Definition of Done:** Semua acceptance criteria kritis terpenuhi dan didemonstrasikan.

**Dokumen ini menjadi baseline pengembangan MVP.** Perubahan scope setelah implementasi dimulai harus dicatat sebagai perubahan kebutuhan, beserta dampaknya terhadap database, arsitektur, pengujian, dan jadwal.
