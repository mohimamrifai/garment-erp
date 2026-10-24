import type { RoleCode } from "@/lib/permissions";

export type RoleGuideStep = {
  title: string;
  detail: string;
};

export type RoleGuide = {
  code: RoleCode;
  focus: string;
  menus: readonly string[];
  steps: readonly RoleGuideStep[];
  note: string;
};

/**
 * Panduan penggunaan ERP per role. Isi mengikuti menu dan izin di
 * `permissions.ts`; tambahkan role baru di sini agar halaman /docs tetap lengkap.
 */
export const ROLE_GUIDES: readonly RoleGuide[] = [
  {
    code: "ADMIN",
    focus: "Menjaga master data, akun pengguna, dan kelancaran seluruh alur operasional.",
    menus: ["Dashboard", "Master Data", "HRIS", "Payroll", "Akuntansi", "Pengguna", "Audit Log", "Laporan"],
    steps: [
      {
        title: "Siapkan master data",
        detail:
          "Lengkapi produk dan varian, BOM, material, satuan, gudang, supplier, serta data organisasi sebelum transaksi berjalan.",
      },
      {
        title: "Kelola akun dan role",
        detail:
          "Buka Pengguna → Tambah Pengguna. Tentukan role dan password awal, lalu nonaktifkan akun yang sudah tidak bertugas.",
      },
      {
        title: "Pantau operasional",
        detail:
          "Gunakan Dashboard dan Laporan untuk melihat pesanan, pembelian, stok, produksi, dan pengiriman yang perlu ditindaklanjuti.",
      },
      {
        title: "Bantu penyelesaian dokumen",
        detail:
          "Posting penerimaan, output produksi, inspeksi QC, atau surat jalan bila operator membutuhkan eskalasi.",
      },
      {
        title: "Pantau back-office",
        detail:
          "Periksa absensi/cuti, payroll, jurnal, kas/bank, dan laporan keuangan. Pastikan periode ditutup hanya setelah semua jurnal diposting.",
      },
      {
        title: "Tinjau Audit Log",
        detail:
          "Periksa aktor, aksi, entitas, dan detail perubahan untuk investigasi atau kontrol internal.",
      },
    ],
    note: "Gunakan akun Administrator untuk konfigurasi dan koreksi, bukan untuk menjalankan semua operasi harian.",
  },
  {
    code: "MANAGER",
    focus: "Memantau kinerja operasional dan membantu penyelesaian dokumen lintas modul.",
    menus: [
      "Dashboard",
      "Sales Order",
      "Pembelian",
      "Produksi",
      "Quality Control",
      "Pengiriman",
      "HRIS",
      "Payroll",
      "Akuntansi",
      "Laporan",
      "Laporan Keuangan",
    ],
    steps: [
      {
        title: "Mulai dari Dashboard",
        detail:
          "Lihat ringkasan penjualan, pembelian, stok, produksi, dan pemenuhan untuk menentukan prioritas hari ini.",
      },
      {
        title: "Analisis laporan",
        detail:
          "Buka Laporan, pilih jenis laporan dan periode, lalu gunakan Ekspor CSV bila data perlu diolah lebih lanjut.",
      },
      {
        title: "Tinjau dokumen berjalan",
        detail:
          "Filter sales order, purchase order, SPK, atau surat jalan yang masih draf atau tertunda, lalu koordinasikan tindak lanjutnya.",
      },
      {
        title: "Bantu konfirmasi dan posting",
        detail:
          "Manager dapat mengonfirmasi pesanan, memesan PO, memposting penerimaan, mencatat produksi, dan memposting pengiriman bila diperlukan.",
      },
      {
        title: "Tinjau payroll dan keuangan",
        detail:
          "Buka Payroll untuk menyetujui payroll, dan Akuntansi untuk memeriksa jurnal, kas/bank, serta laporan keuangan sebelum tutup buku.",
      },
      {
        title: "Eskalasi akses khusus",
        detail:
          "Pengelolaan pengguna dan Audit Log hanya tersedia untuk Administrator; minta bantuan Administrator untuk perubahan akun.",
      },
    ],
    note: "Manager dapat menjalankan sebagian besar operasi dan menyetujui payroll, tetapi tidak dapat mengelola pengguna, membuka Audit Log, atau menutup buku.",
  },
  {
    code: "SALES",
    focus: "Mengelola buyer dan sales order sampai barang siap dikirim.",
    menus: ["Buyer", "Sales Order", "Produk", "Barang Jadi", "Pengiriman", "Laporan"],
    steps: [
      {
        title: "Daftarkan buyer",
        detail:
          "Buka Buyer → Tambah Buyer. Isi nama, kontak, alamat, dan termin pembayaran yang disepakati.",
      },
      {
        title: "Buat sales order",
        detail:
          "Buka Sales Order → Buat Sales Order. Pilih buyer dan tanggal, lalu tambahkan produk/varian, kuantitas, dan harga.",
      },
      {
        title: "Konfirmasi pesanan",
        detail:
          "Periksa kembali item dan total, lalu pilih Konfirmasi. Pesanan yang sudah dikonfirmasi tidak dapat diubah dan siap masuk produksi.",
      },
      {
        title: "Pantau pemenuhan",
        detail:
          "Di detail pesanan, buka bagian Pemenuhan & Pengiriman untuk melihat jumlah dipesan, terkirim, teralokasi, dan sisa.",
      },
      {
        title: "Siapkan pengiriman",
        detail:
          "Gunakan Buat Pengiriman dari pesanan yang siap kirim. Simpan draf, lalu koordinasikan posting dengan Gudang atau Staff Pengiriman.",
      },
    ],
    note: "Sales dapat membuat draf pengiriman dan mengalokasikan barang jadi, tetapi posting surat jalan dilakukan Gudang atau Staff Pengiriman.",
  },
  {
    code: "PURCHASING",
    focus: "Mengelola supplier, purchase order, dan penerimaan material.",
    menus: [
      "Pembelian",
      "Penerimaan",
      "Supplier",
      "Material",
      "Satuan",
      "Gudang",
      "Inventori",
      "Mutasi Stok",
      "Laporan",
    ],
    steps: [
      {
        title: "Siapkan data pembelian",
        detail:
          "Pastikan supplier, material, satuan, dan gudang/lokasi sudah benar. Perubahan master data material dan satuan dilakukan Administrator atau Manager.",
      },
      {
        title: "Buat purchase order",
        detail:
          "Buka Pembelian → Buat Purchase Order. Pilih supplier, tambahkan material, kuantitas, dan harga, lalu simpan sebagai draf.",
      },
      {
        title: "Pesan ke supplier",
        detail:
          "Buka detail PO dan pilih Pesan ke Supplier. PO yang sudah dipesan tidak dapat diubah lagi.",
      },
      {
        title: "Catat penerimaan",
        detail:
          "Dari PO pilih Terima Barang, isi kuantitas yang diterima per item dan lokasi penyimpanan. Penerimaan parsial diperbolehkan.",
      },
      {
        title: "Posting penerimaan",
        detail:
          "Buka detail penerimaan lalu pilih Posting. Stok material bertambah dan pergerakannya tercatat di Mutasi Stok.",
      },
      {
        title: "Periksa stok",
        detail:
          "Gunakan Inventori dan Mutasi Stok untuk memastikan kuantitas serta dokumen referensi sudah sesuai.",
      },
    ],
    note: "Periksa kuantitas dan lokasi sebelum posting. Penerimaan yang sudah diposting tidak dapat diubah atau dibatalkan.",
  },
  {
    code: "WAREHOUSE",
    focus: "Menjaga akurasi stok material dan barang jadi di setiap lokasi.",
    menus: [
      "Penerimaan",
      "Pembelian",
      "Inventori",
      "Mutasi Stok",
      "Barang Jadi",
      "Pengiriman",
      "Material",
      "Gudang",
      "Laporan",
    ],
    steps: [
      {
        title: "Posting penerimaan",
        detail:
          "Buka Penerimaan, pilih draf yang sesuai PO, cocokkan kuantitas fisik dan lokasi, lalu posting agar stok material bertambah.",
      },
      {
        title: "Periksa stok",
        detail:
          "Buka Inventori, filter gudang, dan perhatikan penanda stok minimum sebelum menyetujui permintaan berikutnya.",
      },
      {
        title: "Pindahkan stok",
        detail:
          "Gunakan Transfer Stok untuk memindahkan material atau barang jadi antar lokasi dengan kuantitas yang jelas.",
      },
      {
        title: "Sesuaikan stok",
        detail:
          "Gunakan Penyesuaian Stok untuk hasil opname atau barang rusak. Selalu isi alasan agar perubahan mudah ditelusuri.",
      },
      {
        title: "Posting pengiriman",
        detail:
          "Buka draf Pengiriman yang sudah disiapkan Sales atau Staff Pengiriman, periksa item dan kuantitas, lalu pilih Posting Pengiriman.",
      },
      {
        title: "Telusuri mutasi",
        detail:
          "Buka Mutasi Stok untuk memeriksa asal perubahan, dokumen referensi, dan aktor yang mencatatnya.",
      },
    ],
    note: "Jangan mengubah saldo stok secara langsung. Semua perubahan harus lewat penerimaan, transfer, penyesuaian, produksi, atau pengiriman.",
  },
  {
    code: "PRODUCTION_SUPERVISOR",
    focus: "Merencanakan SPK dan mencatat progres produksi di setiap tahap.",
    menus: [
      "Produksi",
      "BOM",
      "Produk",
      "Lini Produksi",
      "Karyawan",
      "Departemen",
      "Quality Control",
      "Inventori",
      "Mutasi Stok",
      "Laporan",
    ],
    steps: [
      {
        title: "Pastikan data produksi",
        detail:
          "Periksa produk/varian, BOM versi aktif, lini produksi, dan karyawan yang akan mengerjakan pesanan.",
      },
      {
        title: "Buat SPK",
        detail:
          "Buka Produksi → Buat SPK. Pilih item sales order yang sudah dikonfirmasi, tentukan kuantitas, lini, dan tanggal produksi.",
      },
      {
        title: "Periksa kebutuhan material",
        detail:
          "Saat membuat SPK, gunakan Periksa Ketersediaan. Bila material kurang, isi alasan tetap dijalankan atau lengkapi stok terlebih dahulu.",
      },
      {
        title: "Catat output tahap",
        detail:
          "Di detail SPK, catat output Cutting → Sewing → Finishing → Packing, termasuk kuantitas lolos, cacat, dan rework.",
      },
      {
        title: "Catat pemakaian material",
        detail:
          "Gunakan Catat Pemakaian Material agar stok berkurang lewat mutasi dan kebutuhan aktual tercatat.",
      },
      {
        title: "Koordinasi dengan QC",
        detail:
          "Minta Staff QC memeriksa output yang sudah dicatat. Pantau hasil inspeksi dan selesaikan rework sebelum menutup SPK.",
      },
    ],
    note: "Supervisor mencatat output dan pemakaian material; hasil inspeksi QC diisi oleh Staff QC, Manager, atau Administrator.",
  },
  {
    code: "QC_STAFF",
    focus: "Memeriksa output tiap tahap dan menentukan hasil kualitas.",
    menus: ["Quality Control", "Produksi", "Laporan"],
    steps: [
      {
        title: "Pantau output produksi",
        detail:
          "Buka Produksi untuk melihat SPK dan tahap yang sudah memiliki output dari Supervisor Produksi.",
      },
      {
        title: "Buat inspeksi",
        detail:
          "Buka Quality Control → Inspeksi Baru. Pilih SPK dan tahap yang masih memiliki output belum diperiksa.",
      },
      {
        title: "Catat hasil pemeriksaan",
        detail:
          "Isi kuantitas diperiksa, lolos, dan ditolak. Tambahkan jenis cacat serta catatan bila ada temuan.",
      },
      {
        title: "Tentukan keputusan",
        detail:
          "Pilih Lolos, Rework, atau Gagal. Untuk Rework, buat inspeksi ulang dari detail inspeksi induk setelah barang diperbaiki.",
      },
      {
        title: "Pastikan lot barang jadi",
        detail:
          "Inspeksi tahap Packing yang Lolos akan membuat lot barang jadi masuk ke stok gudang.",
      },
    ],
    note: "QC tidak mencatat output produksi. Jika output belum tersedia, koordinasikan dengan Supervisor Produksi terlebih dahulu.",
  },
  {
    code: "SHIPPING_STAFF",
    focus: "Menyiapkan surat jalan dan memastikan barang jadi keluar sesuai pesanan.",
    menus: ["Barang Jadi", "Pengiriman", "Laporan"],
    steps: [
      {
        title: "Cek ketersediaan barang jadi",
        detail:
          "Buka Barang Jadi untuk melihat stok tersedia per varian dan lokasi, termasuk lot dari inspeksi QC akhir.",
      },
      {
        title: "Buat pengiriman",
        detail:
          "Buka Pengiriman → Buat Pengiriman. Pilih sales order yang siap kirim atau baru terkirim sebagian, lalu tentukan item, lokasi, dan kuantitas.",
      },
      {
        title: "Pastikan alokasi",
        detail:
          "Bila sisa pesanan belum dialokasikan, koordinasikan dengan Sales karena alokasi disiapkan dari detail Sales Order.",
      },
      {
        title: "Periksa draf",
        detail:
          "Cocokkan buyer, alamat, item, kuantitas, dan nomor surat jalan sebelum barang diserahkan ke pengiriman.",
      },
      {
        title: "Posting pengiriman",
        detail:
          "Pilih Posting Pengiriman. Stok barang jadi berkurang, alokasi dilepas, dan status sales order diperbarui.",
      },
    ],
    note: "Draf pengiriman masih dapat dibatalkan. Setelah diposting, stok sudah keluar dan surat jalan tidak dapat dibatalkan.",
  },
  {
    code: "HR_STAFF",
    focus: "Mengelola data kepegawaian, absensi, dan cuti agar payroll akurat.",
    menus: ["Dashboard", "Karyawan", "Departemen", "Absensi", "Cuti", "Payroll", "Laporan"],
    steps: [
      {
        title: "Lengkapi data karyawan",
        detail:
          "Buka Karyawan → Tambah Karyawan. Isi departemen, jabatan, tanggal masuk, gaji pokok, tunjangan, status pajak, dan data bank.",
      },
      {
        title: "Catat absensi",
        detail:
          "Buka Absensi, pilih bulan, lalu catat kehadiran, keterlambatan, dan jam lembur. Absensi yang sama tidak boleh dicatat dua kali.",
      },
      {
        title: "Kelola cuti",
        detail:
          "Buka Cuti → Ajukan Cuti. Setujui atau tolak pengajuan; cuti tidak dibayar akan mengurangi gaji pada payroll.",
      },
      {
        title: "Periksa kesiapan payroll",
        detail:
          "Pastikan absensi dan cuti periode berjalan sudah lengkap sebelum Admin Payroll membuat payroll.",
      },
    ],
    note: "Staff HR tidak membuat atau membayar payroll. Perubahan data gaji karyawan sebaiknya dikoordinasikan dengan Admin Payroll.",
  },
  {
    code: "PAYROLL_ADMIN",
    focus: "Menghitung, menyetujui, dan membayar payroll bulanan secara akurat.",
    menus: ["Dashboard", "Karyawan", "Absensi", "Cuti", "Payroll", "Kas & Bank", "Laporan"],
    steps: [
      {
        title: "Pastikan data periode",
        detail:
          "Periksa absensi, lembur, cuti disetujui, dan data gaji karyawan aktif sebelum membuat payroll.",
      },
      {
        title: "Buat payroll",
        detail:
          "Buka Payroll → Buat Payroll, pilih periode bulanan, lalu periksa slip gaji, BPJS, PPh 21, dan total neto.",
      },
      {
        title: "Setujui payroll",
        detail:
          "Setelah data benar, pilih Setujui. Jurnal beban gaji dan kewajiban pajak/BPJS diposting otomatis ke akuntansi.",
      },
      {
        title: "Bayar payroll",
        detail:
          "Pada payroll berstatus Disetujui, pilih Bayar, tentukan akun kas/bank dan tanggal pembayaran.",
      },
      {
        title: "Rekonsiliasi",
        detail:
          "Cocokkan total neto payroll dengan mutasi kas/bank dan periksa jurnal payroll di Akuntansi.",
      },
    ],
    note: "Payroll yang sudah disetujui tidak dapat diubah. Koreksi dilakukan lewat pembatalan draf sebelum disetujui atau jurnal pembalik setelah posting.",
  },
  {
    code: "FINANCE_STAFF",
    focus: "Menjaga pembukuan, kas & bank, serta laporan keuangan sesuai SAK EMKM.",
    menus: ["Dashboard", "Akuntansi", "Bagan Akun", "Jurnal", "Kas & Bank", "Tutup Buku", "Laporan Keuangan", "Payroll"],
    steps: [
      {
        title: "Periksa bagan akun",
        detail:
          "Buka Akuntansi → Bagan Akun. Pastikan akun, saldo normal, dan akun kas/bank sudah sesuai kebutuhan perusahaan.",
      },
      {
        title: "Catat kas & bank",
        detail:
          "Buka Kas & Bank → Catat Kas/Bank. Pilih penerimaan atau pembayaran, dokumen referensi, akun kas/bank, dan jumlah.",
      },
      {
        title: "Tinjau jurnal",
        detail:
          "Buka Jurnal untuk memeriksa jurnal otomatis dari penjualan, pembelian, produksi, dan payroll. Posting jurnal manual yang masih draf.",
      },
      {
        title: "Buat laporan",
        detail:
          "Buka Laporan Keuangan untuk melihat neraca saldo, laba rugi, neraca, buku besar, arus kas, dan umur piutang/utang.",
      },
      {
        title: "Tutup buku",
        detail:
          "Setelah semua jurnal periode diposting dan direkonsiliasi, buka Tutup Buku dan tutup periode bulanan.",
      },
    ],
    note: "Jurnal yang sudah diposting tidak dapat diubah; gunakan jurnal pembalik untuk koreksi. Tutup buku hanya setelah laporan periode diperiksa.",
  },
];
